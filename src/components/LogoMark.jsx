const LOGO_URL =
  "https://static.wixstatic.com/media/7ee68f_97705f93484f49b892bcd336a22cb144~mv2.png/v1/fill/w_500,h_163,al_c,q_85,enc_avif,quality_auto/GYS.png";

export function LogoMark({ light = false, href = "/" }) {
  return (
    <a href={href} className="inline-block shrink-0" aria-label="GYS Mortgage home">
      <img
        src={LOGO_URL}
        alt="GYS Mortgage"
        className={`h-auto w-36 sm:w-40 ${light ? "brightness-0 invert" : ""}`}
      />
    </a>
  );
}
