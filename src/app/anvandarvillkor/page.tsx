import { redirect } from 'next/navigation';

// Användarvillkoren heter numera "Allmänna villkor" och ligger på /allmanna-villkor.
// Behåller denna route som permanent omdirigering så gamla länkar fortsätter att fungera.
export default function AnvandarvillkorRedirect() {
  redirect('/allmanna-villkor');
}
