import { useCallback, useEffect, useState } from "react";
import { FormPageLayout } from "./components/FormPageLayout";
import { LandingView } from "./stages/LandingView";
import { RejectionView } from "./stages/RejectionView";
import { Screener } from "./stages/Screener";
import { PrivacyPolicyView } from "./stages/PrivacyPolicyView";
import { SubmissionForm } from "./stages/SubmissionForm";
import { TermsDisclaimerView } from "./stages/TermsDisclaimerView";
import { WebsiteView } from "./stages/WebsiteView";

const PATH_BY_STAGE = {
  landing: "/submission",
  screener: "/quick-review",
  form: "/full-submission",
  rejected: "/rejected",
  website: "/",
  privacyPolicy: "/privacy-policy",
  termsDisclaimer: "/terms-disclaimer",
};

const STAGE_BY_PATH = {
  "/": "website",
  "/submission": "landing",
  "/quick-review": "screener",
  "/full-submission": "form",
  "/rejected": "rejected",
  "/privacy-policy": "privacyPolicy",
  "/terms-disclaimer": "termsDisclaimer",
};

const STAGE_BY_HASH = {
  "quick-review": "screener",
  "full-submission": "form",
  rejected: "rejected",
};

function locationToStage() {
  const hashKey = window.location.hash.replace(/^#/, "");
  if (STAGE_BY_HASH[hashKey]) {
    return STAGE_BY_HASH[hashKey];
  }

  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return STAGE_BY_PATH[path] ?? "landing";
}

function stageToUrl(stage) {
  return PATH_BY_STAGE[stage] ?? "/";
}

export default function App() {
  const [stage, setStage] = useState(() => locationToStage());
  const [formData, setFormData] = useState({});
  const [rejectionReason, setRejectionReason] = useState("");

  const navigateToStage = useCallback((newStage) => {
    setStage(newStage);
    window.history.pushState({ stage: newStage }, "", stageToUrl(newStage));
  }, []);

  useEffect(() => {
    const initialStage = locationToStage();
    setStage(initialStage);
    window.history.replaceState({ stage: initialStage }, "", stageToUrl(initialStage));
  }, []);

  useEffect(() => {
    function handlePopState(event) {
      const newStage = event.state?.stage ?? locationToStage();
      setStage(newStage);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handlePass = useCallback(
    (screenerData) => {
      setFormData(screenerData);
      navigateToStage("form");
    },
    [navigateToStage]
  );

  const handleFail = useCallback(
    (_screenerData, reason) => {
      setRejectionReason(reason);
      navigateToStage("rejected");
    },
    [navigateToStage]
  );

  const handleTryAgain = useCallback(() => {
    setRejectionReason("");
    navigateToStage("screener");
  }, [navigateToStage]);

  if (stage === "landing") {
    return (
      <FormPageLayout>
        <LandingView
          onQuickReview={() => navigateToStage("screener")}
          onFullSubmission={() => navigateToStage("form")}
        />
      </FormPageLayout>
    );
  }

  if (stage === "website") {
    return (
      <WebsiteView
        onQuickReview={() => navigateToStage("landing")}
        onFullSubmission={() => navigateToStage("form")}
      />
    );
  }

  if (stage === "privacyPolicy") {
    return <PrivacyPolicyView />;
  }

  if (stage === "termsDisclaimer") {
    return <TermsDisclaimerView />;
  }

  if (stage === "form") {
    return (
      <FormPageLayout>
        <SubmissionForm initialData={formData} />
      </FormPageLayout>
    );
  }

  if (stage === "rejected") {
    return (
      <FormPageLayout>
        <RejectionView reason={rejectionReason} onTryAgain={handleTryAgain} />
      </FormPageLayout>
    );
  }

  return (
    <FormPageLayout>
      <Screener onPass={handlePass} onFail={handleFail} />
    </FormPageLayout>
  );
}
