// The keys of one shortcut as key caps joined by plus signs.
export function Keys({ keys, recording }: { keys: string[]; recording: boolean }) {
  return (
    <>
      {keys.map((key, index) => (
        <span key={index} style={{ display: 'contents' }}>
          <kbd className="shortcut-recorder-key" data-recording={recording || undefined}>
            {key}
          </kbd>
          {index < keys.length - 1 ? <span className="shortcut-recorder-separator">+</span> : null}
        </span>
      ))}
    </>
  )
}
