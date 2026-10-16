export default function Globe({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 600 600" aria-hidden="true">
      <circle cx="300" cy="300" r="290" />
      <ellipse cx="300" cy="300" rx="210" ry="290" />
      <ellipse cx="300" cy="300" rx="110" ry="290" />
      <line x1="300" y1="10" x2="300" y2="590" />
      <line x1="90" y1="100" x2="510" y2="100" />
      <line x1="28" y1="200" x2="572" y2="200" />
      <line x1="10" y1="300" x2="590" y2="300" />
      <line x1="28" y1="400" x2="572" y2="400" />
      <line x1="90" y1="500" x2="510" y2="500" />
    </svg>
  )
}
