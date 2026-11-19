import {env} from 'cloudflare:workers';
import {notFound} from 'next/navigation';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '../../src/themes/haru/haru.css';
import '../haru-controls.css';
import Foundation from './foundation';

// No navigation entry or production binding. Only an owned local QA profile enables it.
export default function FoundationPage() {
  if ((env as Record<string, unknown>).astryx_foundation_enabled !== 'true') notFound();
  return <main><Foundation /></main>;
}
