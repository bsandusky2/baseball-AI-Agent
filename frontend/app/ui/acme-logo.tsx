import Image from 'next/image';

export default function AcmeLogo() {
  return (
    <div className="flex flex-row items-center leading-none">
      <Image
        src="/MLB Agent.png"
        alt="MLB Agent logo"
        width={200}
        height={200}
        className="h-12 w-12 md:h-28 md:w-28"
      />
    </div>
  );
}
