import { Message, MessageContent, MessageGroup } from '@/components/ui/message'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { useT } from '@/use-t'
import type { DemoAssistant } from './demo-assistants'
import type { DemoFrame } from './demo-playback'

export function DemoConversation({ frame, assistant }: { frame: DemoFrame; assistant: DemoAssistant }) {
  const { t } = useT()
  return (
    <MessageGroup className="onboarding-demo-messages" aria-label={t('onboardingDemo.conversation')}>
      {frame.transcript ? (
        <Message align="end">
          <MessageContent>
            <Bubble className="onboarding-demo-speech" align="end">
              <BubbleContent>
                <span className="onboarding-demo-speaker">{t('onboardingDemo.otherPerson')}</span>
                <p>{frame.transcript}</p>
              </BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      ) : null}
      {frame.phase === 'insight' ? (
        <Message>
          <MessageContent>
            <Bubble variant="secondary" className="onboarding-demo-insight">
              <BubbleContent>
                <span className="onboarding-demo-speaker">{t(`onboardingDemo.${assistant}`)}</span>
                <h2 tabIndex={-1}>{t(`onboardingDemo.${assistant}Title`)}</h2>
                <p>{t(`onboardingDemo.${assistant}Body`)}</p>
              </BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      ) : null}
    </MessageGroup>
  )
}
