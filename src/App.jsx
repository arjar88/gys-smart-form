import { useCallback, useState } from "react";
import { LandingView } from "./stages/LandingView";
import { RejectionView } from "./stages/RejectionView";
import { Screener } from "./stages/Screener";
import { SubmissionForm } from "./stages/SubmissionForm";

export default function App() {
  const [stage, setStage] = useState("landing");
  const [formData, setFormData] = useState({});
  const [rejectionReason, setRejectionReason] = useState("");

  const handlePass = useCallback((screenerData) => {
    setFormData(screenerData);
    setStage("form");
  }, []);

  const handleFail = useCallback((_screenerData, reason) => {
    setRejectionReason(reason);
    setStage("rejected");
  }, []);

  const handleTryAgain = useCallback(() => {
    setRejectionReason("");
    setStage("screener");
  }, []);

  if (stage === "landing") {
    return (
      <LandingView
        onQuickReview={() => setStage("screener")}
        onFullSubmission={() => setStage("form")}
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
