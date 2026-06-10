export function FormContainer({ title, children, footer, centerTitle = false }) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
      <div className="rounded-2xl bg-gys-form-bg px-6 py-8 sm:px-10 sm:py-10">
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
  );
}
