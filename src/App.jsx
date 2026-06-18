import { useCallback, useEffect, useState } from "react";
import { LandingView } from "./stages/LandingView";
import { RejectionView } from "./stages/RejectionView";
import { Screener } from "./stages/Screener";
import { SubmissionForm } from "./stages/SubmissionForm";

const HASH_BY_STAGE = {
  landing: "",
  screener: "#quick-review",
  form: "#full-submission",
  rejected: "#rejected",
};

const STAGE_BY_HASH = {
  "quick-review": "screener",
  "full-submission": "form",
  rejected: "rejected",
};

function hashToStage(hash) {
  const key = hash.replace(/^#/, "");
  return STAGE_BY_HASH[key] ?? "landing";
}

function stageToUrl(stage) {
  return `${window.location.pathname}${window.location.search}${HASH_BY_STAGE[stage] ?? ""}`;
}

export default function App() {
  const [stage, setStage] = useState(() => hashToStage(window.location.hash));
  const [formData, setFormData] = useState({});
  const [rejectionReason, setRejectionReason] = useState("");

  const navigateToStage = useCallback((newStage) => {
    setStage(newStage);
    window.history.pushState({ stage: newStage }, "", stageToUrl(newStage));
  }, []);

  useEffect(() => {
    window.history.replaceState({ stage }, "", stageToUrl(stage));
  }, []);

  useEffect(() => {
    function handlePopState(event) {
      const newStage = event.state?.stage ?? hashToStage(window.location.hash);
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
      <LandingView
        onQuickReview={() => navigateToStage("screener")}
        onFullSubmission={() => navigateToStage("form")}
      />
    );
  }

  if (stage === "form") {
    return <SubmissionForm initialData={formData} />;
  }

  if (stage === "rejected") {
    return (
      <RejectionView reason={rejectionReason} onTryAgain={handleTryAgain} />
    );
  }

  return <Screener onPass={handlePass} onFail={handleFail} />;
}
