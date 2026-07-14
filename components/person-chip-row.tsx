"use client"

import Image from "next/image"
import { User, X } from "lucide-react"
import type { PersonSearchResult } from "@/lib/api-helpers"

interface PersonChipRowProps {
  people: PersonSearchResult[]
  activePerson: PersonSearchResult | null
  onSelectPerson: (person: PersonSearchResult) => void
  onClearPerson: () => void
}

const DEPARTMENT_LABEL: Record<string, string> = {
  Acting: "Actor",
  Directing: "Director",
  Writing: "Writer",
  Production: "Producer",
}

// Actor/director search for Home's movie/series title search (books excluded -
// no comparable author-search UX). Renders either the "People" chip row (when
// the current query also matches people, alongside title results) or, once a
// person is selected, a single dismissible "Showing results for" chip - see
// components/content-section.tsx for the person-search/filmography state this
// drives.
export function PersonChipRow({ people, activePerson, onSelectPerson, onClearPerson }: PersonChipRowProps) {
  if (activePerson) {
    return (
      <div className="mb-5 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Showing results for:</span>
        <span className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <PersonAvatar person={activePerson} />
          {activePerson.name}
          <button onClick={onClearPerson} className="hover:cursor-pointer" aria-label="Clear person filter">
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      </div>
    )
  }

  if (people.length === 0) return null

  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">People</h3>
      <div className="flex gap-2 flex-wrap">
        {people.map((person) => (
          <button
            key={person.id}
            onClick={() => onSelectPerson(person)}
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-surface-elevated hover:bg-border transition-colors text-sm font-medium text-foreground hover:cursor-pointer"
          >
            <PersonAvatar person={person} />
            {person.name}
            {person.known_for_department && (
              <span className="text-xs text-muted-foreground">
                {DEPARTMENT_LABEL[person.known_for_department] ?? person.known_for_department}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function PersonAvatar({ person }: { person: PersonSearchResult }) {
  return (
    <div className="w-6 h-6 rounded-full overflow-hidden bg-surface-tonal flex items-center justify-center shrink-0">
      {person.profile_path ? (
        <Image
          src={`https://image.tmdb.org/t/p/w45${person.profile_path}`}
          alt={person.name}
          width={24}
          height={24}
          className="object-cover"
        />
      ) : (
        <User className="w-3.5 h-3.5 text-muted-foreground" />
      )}
    </div>
  )
}
