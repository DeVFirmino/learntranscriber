export interface ScreenPoint {
  pointerId: number
  screenX: number
  screenY: number
}
export interface NotchBounds {
  x: number
  y: number
  width: number
  height: number
}
export interface PointerOffset {
  dx: number
  dy: number
}

// Where a drag of the collapsed Notch starts when the window has not reported its bounds yet.
export const collapsedNotchBounds: NotchBounds = { x: 0, y: 0, width: 84, height: 48 }

// A press becomes a drag or a resize only past this distance, so a click on the collapsed Notch still opens it.
const THRESHOLD = 4

// One drag or resize of the Notch, following only the pointer that started it.
export class PointerGesture {
  readonly bounds: NotchBounds
  private pointerId: number
  private startX: number
  private startY: number
  private moved = false

  constructor(point: ScreenPoint, bounds: NotchBounds) {
    this.pointerId = point.pointerId
    this.startX = point.screenX
    this.startY = point.screenY
    this.bounds = bounds
  }

  owns(point: ScreenPoint): boolean {
    return point.pointerId === this.pointerId
  }

  // The offset to preview while the pointer moves; null for another pointer or before the threshold.
  move(point: ScreenPoint): PointerOffset | null {
    if (!this.owns(point)) return null
    const offset = this.offset(point)
    if (!this.moved && Math.hypot(offset.dx, offset.dy) < THRESHOLD) return null
    this.moved = true
    return offset
  }

  // The offset to commit when the pointer lifts; null when the press never became a gesture.
  end(point: ScreenPoint): PointerOffset | null {
    return this.moved ? this.offset(point) : null
  }

  position({ dx, dy }: PointerOffset) {
    return { x: this.bounds.x + dx, y: this.bounds.y + dy }
  }

  size({ dx, dy }: PointerOffset) {
    return { width: this.bounds.width + dx, height: this.bounds.height + dy }
  }

  private offset(point: ScreenPoint): PointerOffset {
    return { dx: point.screenX - this.startX, dy: point.screenY - this.startY }
  }
}
