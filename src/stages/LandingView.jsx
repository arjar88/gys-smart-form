export function LandingView({ onQuickReview, onFullSubmission }) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
      <div className="rounded-2xl bg-gys-form-bg px-6 py-8 sm:px-10 sm:py-10">
        <h1 className="mb-3 font-serif text-[2rem] font-bold leading-tight text-gys-label">
          GYS Mortgage
        </h1>
        <p className="mb-10 text-[15px] leading-relaxed text-gys-label/70">
          Choose how you&apos;d like to get started.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={onQuickReview}
            className="group flex flex-col rounded-xl border-2 border-gys-primary/20 bg-white p-6 text-left transition hover:border-gys-primary hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gys-primary/10 text-gys-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path
                  fillRule="evenodd"
                  d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 0 1-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.513 1.324 1.513 3.518 0 4.842a3.75 3.75 0 0 1-.837.552c-.676.328-1.028.774-1.028 1.152v.75a.75.75 0 0 1-1.5 0v-.75c0-1.279 1.06-2.107 1.875-2.502.182-.088.351-.199.503-.331.83-.727.83-1.857 0-2.584ZM12 18a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-[1.1rem] font-bold text-gys-label">
              Quick Review
            </h2>
            <p className="text-[14px] leading-relaxed text-gys-label/60">
              Not sure if your deal qualifies? Enter a few property details and
              we&apos;ll check it against our criteria instantly.
            </p>
          </button>

          <button
            type="button"
            onClick={onFullSubmission}
            className="group flex flex-col rounded-xl border-2 border-gys-primary/20 bg-white p-6 text-left transition hover:border-gys-primary hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gys-primary/10 text-gys-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625Z" />
                <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.088Z" />
              </svg>
            </div>
            <h2 className="mb-2 text-[1.1rem] font-bold text-gys-label">
              Full Submission
            </h2>
            <p className="text-[14px] leading-relaxed text-gys-label/60">
              Ready to submit a complete file? Fill out the full submission form
              and our team will review it and be in touch.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
