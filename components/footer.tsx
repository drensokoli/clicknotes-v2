import React from 'react';
import Link from 'next/link';

const Footer: React.FC = () => {
  return (
    <footer className="bg-background p-4 bottom-0 w-full flex flex-col items-center justify-center">
      <h1 className='text-md'>Made with ❤️ by
        <span className="text-blue-600">
          <Link href="https://linktr.ee/drensokoli" target="_blank" aria-label='Dren Sokoli LinkedIn Profile'> Dren Sokoli</Link>
        </span>
      </h1>
      <p className="mr-2 text-md">
        &copy; {new Date().getFullYear()}{' '}
        <span className="text-blue-600">
          <Link href="https://github.com/drensokoli/clicknotes-v2" target="_blank" aria-label='ClickNotes v2 GitHub Repo'>ClickNotes v2</Link>
        </span>
      </p>
      <div className='flex flex-row gap-4 pt-2'>
        <Link href="/privacy-policy.html" target="_blank" aria-label='Privacy Policy' className='text-sm text-blue-600 hover:underline'>Privacy Policy</Link>
        <Link href="/terms-and-conditions.html" target="_blank" aria-label='Terms and Conditions' className='text-sm text-blue-600 hover:underline'>Terms of Use</Link>
      </div>
    </footer>
  );
};

export default Footer;
