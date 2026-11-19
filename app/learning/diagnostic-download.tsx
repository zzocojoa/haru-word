import { exportClientDiagnostics } from "@/lib/client-diagnostics";
import { download } from "../ui";
import {HaruButton} from '../haru-controls';

export function DiagnosticDownload() {
  return <HaruButton label="문제 진단 기록 받기" variant="ghost" onClick={() => download("haru-diagnostics.json", exportClientDiagnostics(), "application/json")} />;
}
