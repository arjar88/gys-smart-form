export function SubmitButton({
  children = "Submit",
  loading = false,
  disabled = false,
  type = "submit",
  form,
  onClick,
  className = "",
}) {
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex min-w-[120px] items-center justify-center rounded-full bg-gys-primary px-8 py-3 text-[15px] font-semibold text-white transition hover:bg-gys-primary-hover disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}
