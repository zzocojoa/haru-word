import { exportClientDiagnostics } from "@/lib/client-diagnostics";
import { download } from "../ui";

export function DiagnosticDownload() {
  return <button className="text-button" onClick={() => download("haru-diagnostics.json", exportClientDiagnostics(), "application/json")}>
    문제 진단 기록 받기
  </button>;
}
