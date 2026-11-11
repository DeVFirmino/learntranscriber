import { INSIGHT_MODES, insightMode, type InsightTrigger } from './insight-modes'
import { lastQuestion, questionKey } from './spoken-question'

// A live insight can answer a spoken question from THEY, the user falling silent
// after speaking, or a periodic check with new speech. Nothing is requested while the user is speaking or while
// the previous insight is still running.
export interface HeardLine {
  speaker: string
  text: string
  at: number
}

export interface InsightSnapshot {
  now: number
  mode: string
  // Finalized utterances of the listening session, oldest first.
  lines: HeardLine[]
  // Text being recognized right now, per speaker.
  live: Record<string, string>
  inFlight: boolean
  isMeHesitating?: boolean
}

const MIN_GAP_MS = 3_000
// A failing provider is retried after 3 s, then twice as long after each further failure, up to two minutes, so a
// rejected key does not raise an error every few seconds while listening.
const MAX_RETRY_MS = 120_000
const LIVE_QUESTION_STABLE_MS = 750

export class InsightScheduler {
  private boundary = 0
  private lastRequestAt = 0
  // The clock for questions: the last request actually sent (none yet after a reset).
  private lastAskedAt = Number.NEGATIVE_INFINITY
  // After a delivered insight, periodic checks are held until the other side says something new.
  private suggestionPending = false
  private liveQuestion = ''
  private liveQuestionSince = 0
  private offeredLiveQuestion = ''
  private coveredLiveQuestion = ''
  private suppressedLiveQuestion = ''
  private retryAt = 0
  private failures = 0
  private checkpoint: {
    boundary: number
    lastRequestAt: number
    coveredLiveQuestion: string
    suppressedLiveQuestion: string
    lastAskedAt: number
  } | null = null
  question = ''

  /** Starts a new listening run: earlier speech is not a reason for an insight. */
  reset(lines: number, now: number) {
    this.boundary = lines
    this.lastRequestAt = now
    this.lastAskedAt = Number.NEGATIVE_INFINITY
    this.suggestionPending = false
    this.liveQuestion = ''
    this.liveQuestionSince = now
    this.offeredLiveQuestion = ''
    this.coveredLiveQuestion = ''
    this.suppressedLiveQuestion = ''
    this.question = ''
    this.retryAt = 0
    this.failures = 0
    this.checkpoint = null
  }

  decide(snapshot: InsightSnapshot): InsightTrigger | null {
    const { now, lines, live } = snapshot
    const liveQuestion = lastQuestion(live.THEY || '')
    if (!liveQuestion) this.suppressedLiveQuestion = ''
    if (liveQuestion !== this.liveQuestion) {
      this.liveQuestion = liveQuestion
      this.liveQuestionSince = now
    }
    this.offeredLiveQuestion = ''
    this.question = ''
    if (snapshot.inFlight || now < this.retryAt) return null
    const config = INSIGHT_MODES[insightMode(snapshot.mode)]
    const hesitating = Boolean(config.userSilence && snapshot.isMeHesitating)
    const meSpeaking = Boolean(live.ME?.trim()) && !hesitating
    // A provisional question can be answered before it becomes a saved utterance. Consume its matching final
    // once; a later repetition remains a new question. A revised final can still ask for an updated answer.
    if (this.coveredLiveQuestion) {
      const finalIndex = lines.findIndex((line, index) => index >= this.boundary && line.speaker === 'THEY')
      if (finalIndex >= 0) {
        if (questionKey(lastQuestion(lines[finalIndex].text)) === this.coveredLiveQuestion) {
          this.boundary = finalIndex + 1
          this.suppressedLiveQuestion = this.coveredLiveQuestion
        }
        this.coveredLiveQuestion = ''
      }
    }
    const fresh = lines.slice(this.boundary)
    const speech = fresh
      .filter((line) => line.speaker === 'THEY')
      .map((line) => line.text)
      .join(' ')
      .trim()
    const question = lastQuestion(speech)
    // A question also waits the minimum gap (min(3 s, mode interval)) after the previous request.
    const questionReady = now - this.lastAskedAt >= MIN_GAP_MS
    if (question && !meSpeaking && questionReady) {
      this.question = question
      if (questionKey(liveQuestion) === questionKey(question)) this.suppressedLiveQuestion = questionKey(question)
      return 'question'
    }
    if (
      liveQuestion &&
      !this.coveredLiveQuestion &&
      questionKey(liveQuestion) !== this.suppressedLiveQuestion &&
      !meSpeaking &&
      questionReady &&
      now - this.liveQuestionSince >= LIVE_QUESTION_STABLE_MS
    ) {
      this.offeredLiveQuestion = questionKey(liveQuestion)
      this.question = liveQuestion
      return 'question'
    }
    if (meSpeaking || now - this.lastRequestAt < MIN_GAP_MS) return null
    const silence = config.userSilence
    const mine = fresh.filter((line) => line.speaker === 'ME')
    if (
      silence &&
      mine.length >= silence.minUserMessages &&
      (hesitating || now - mine[mine.length - 1].at >= silence.silenceMs)
    )
      return 'user-help'
    if (this.suggestionPending && !speech) return null
    if (config.periodicMs !== null && fresh.length > 0 && now - this.lastRequestAt >= config.periodicMs)
      return 'periodic'
    return null
  }

  /** Records a request covering every finalized line so far. */
  requested(lines: number, now: number) {
    this.checkpoint = {
      boundary: this.boundary,
      lastRequestAt: this.lastRequestAt,
      coveredLiveQuestion: this.coveredLiveQuestion,
      suppressedLiveQuestion: this.suppressedLiveQuestion,
      lastAskedAt: this.lastAskedAt,
    }
    this.boundary = lines
    this.lastRequestAt = now
    this.lastAskedAt = now
    this.suggestionPending = false
    if (this.offeredLiveQuestion) this.coveredLiveQuestion = this.offeredLiveQuestion
  }

  /** A delivered insight: periodic checks wait for new speech from the other side. */
  completed(delivered = true) {
    this.checkpoint = null
    this.retryAt = 0
    this.failures = 0
    this.suggestionPending = delivered
  }

  failed(now: number) {
    if (!this.checkpoint) return
    Object.assign(this, this.checkpoint)
    this.checkpoint = null
    this.failures += 1
    this.retryAt = now + Math.min(MIN_GAP_MS * 2 ** (this.failures - 1), MAX_RETRY_MS)
  }
}
