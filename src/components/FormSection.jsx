export function FormSection({ title, children, largeTitle = false }) {
  return (
    <section className="mb-8">
      {title && (
        <h2
          className={`mb-5 font-bold text-gys-label ${
            largeTitle ? "text-xl" : "text-lg"
          }`}
        >
          {title}
        </h2>
      )}
      <div className="space-y-5">{children}</div>
    </section>
  );
}
