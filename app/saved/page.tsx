import { redirect } from "next/navigation"

// The Library page moved to /library - keep this route redirecting so existing
// bookmarks/links to /saved keep working. See app/library/page.tsx.
export default function SavedRedirect() {
  redirect("/library")
}
