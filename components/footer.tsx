import React from 'react';
import Link from 'next/link';

const Footer: React.FC = () => {
  return (
    <footer className="bg-background p-4 bottom-0 w-full flex flex-col items-center justify-center gap-2">
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        Made with ❤️ by{" "}
        <Link
          href="https://linktr.ee/drensokoli"
          target="_blank"
          aria-label="Dren Sokoli Linktree Profile"
        >
          Dren Sokoli
        </Link>
      </div>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        &copy; {new Date().getFullYear()}{" "}
        <Link
          href="https://github.com/drensokoli/clicknotes-v2"
          target="_blank"
          aria-label="ClickNotes v2 GitHub Repo"
        >
          ClickNotes v2
        </Link>
      </div>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        <Link href="https://www.clicknotes.site/terms-and-conditions.html" target="_blank" rel="noopener noreferrer" aria-label='Terms and Conditions'>Terms of Service</Link>{" "}
        and <Link href="https://www.clicknotes.site/privacy-policy.html" target="_blank" rel="noopener noreferrer" aria-label='Privacy Policy'>Privacy Policy</Link>
      </div>
    </footer>
  );
};

export default Footer;
