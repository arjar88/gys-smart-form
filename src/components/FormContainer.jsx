export function FormContainer({
  title,
  children,
  footer,
  centerTitle = false,
  onBack,
}) {
  return (
    <div className="mx-auto w-full max-w-[840px] px-4 py-6 sm:px-6">
      <div className="flex items-start gap-4 sm:gap-5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-8 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gys-input-border bg-white text-gys-label/75 shadow-sm transition-all hover:-translate-x-0.5 hover:border-gys-primary/40 hover:text-gys-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gys-primary/30 sm:mt-10"
            aria-label="Back to form selection"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1 rounded-2xl bg-gys-form-bg px-6 py-8 sm:px-10 sm:py-10">
          {title && (
            <h1
              className={`mb-8 font-serif text-[2rem] font-bold leading-tight text-gys-label${
                centerTitle ? " text-center" : ""
              }`}
            >
              {title}
            </h1>
          )}
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}
