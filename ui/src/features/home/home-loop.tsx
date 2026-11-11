const base = import.meta.env.BASE_URL
const FOOTAGE = 'home-loop-footage absolute inset-0 size-full object-cover object-bottom opacity-90'

// The Home heading's ambient loop: soft blue light waves along the bottom of the heading, faded behind the title. The
// footage is light on black, so the light theme inverts it and turns the hue back to the brand blue. Under reduced
// motion the still first frame stays and the video is not shown.
export function HomeLoop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden mask-b-from-80%">
      <img src={`${base}home-loop.jpg`} alt="" className={FOOTAGE} />
      <video
        src={`${base}home-loop.mp4`}
        poster={`${base}home-loop.jpg`}
        autoPlay
        muted
        loop
        playsInline
        className={`${FOOTAGE} motion-reduce:hidden`}
      />
      <div className="home-loop-veil absolute inset-0 dark:bg-linear-to-r dark:from-background/85 dark:via-background/30 dark:to-transparent" />
    </div>
  )
}
