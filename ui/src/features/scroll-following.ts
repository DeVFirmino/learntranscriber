export interface ScrollPosition {
  scrollHeight: number
  clientHeight: number
  scrollTop: number
}

export function atLatest(position: ScrollPosition): boolean {
  return position.scrollHeight - position.clientHeight - position.scrollTop < 40
}

// Content growth is not evidence that the reader scrolled away.
export class ScrollFollowing {
  following = true
  pause() {
    this.following = false
  }
  scrolled(position: ScrollPosition) {
    if (atLatest(position)) this.following = true
    return this.following
  }
}
