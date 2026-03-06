import { GlobeAltIcon } from '@heroicons/react/24/outline';
import { lusitana } from '@/app/ui/fonts';

export default function AcmeLogo() {
  return (
    <div
      className={`${lusitana.className} flex flex-row items-center leading-none text-white`}
    >
      <GlobeAltIcon className="h-12 w-12 rotate-[15deg]" />
      <p className="text-[44px]">Panel</p>
    </div>
  );
}


// export default function AcmeLogo() {
//   return (
//     <div className={`flex flex-row items-center leading-none text-white w-full h-full`}>
//       <img
//         src="/logo_fonatur.png"
//         alt="Logo"
//       />
//     </div>
//   );
// }
