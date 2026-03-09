import { lusitana } from '@/app/ui/fonts';

export default function AcmeLogo() {
  return (
    <div
      className={`${lusitana.className} flex w-full flex-row items-center justify-center leading-none text-white`}
    >
      <img 
        src="/Fonaturr2.png" 
        alt="Logo Fonatur"
        className="h-auto w-full object-contain" 
      />
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
