export function FormSection({ title, children }) {
  return (
    <section className="mb-8">
      {title && (
        <h2 className="mb-5 text-lg font-semibold text-gys-label">{title}</h2>
      )}
      <div className="space-y-5">{children}</div>
    </section>
  );
}
