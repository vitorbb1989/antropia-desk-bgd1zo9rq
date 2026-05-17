// Fallback for React.lazy() boundaries while a route chunk loads.
// Intentionally minimal: no Tailwind classes that depend on Layout/theme,
// so this works even at the top-level <Suspense> outside of providers.
export function LoadingScreen() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#fff',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid #e5e7eb',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'antropia-spin 0.9s linear infinite',
        }}
      />
      <style>{`@keyframes antropia-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default LoadingScreen
