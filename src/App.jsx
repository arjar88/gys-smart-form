import { useCallback, useEffect, useState } from "react";
import { RejectionView } from "./stages/RejectionView";
import { Screener } from "./stages/Screener";
import { SubmissionForm } from "./stages/SubmissionForm";

export default function App() {
  const [stage, setStage] = useState("screener");
  const [formData, setFormData] = useState({});
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "setHeight", height }, "*");
    };

    sendHeight();

    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);

    return () => observer.disconnect();
  }, []);

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