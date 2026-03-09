import Link from 'next/link';
import NavLinks from '@/app/ui/dashboard/nav-links';
import AcmeLogo from '@/app/ui/acme-logo';
import { PowerIcon } from '@heroicons/react/24/outline';

export default function SideNav() {
  return (
    <div className="flex h-full flex-col px-3 py-4 md:px-4 md:py-6 bg-white md:border-r border-gray-100/80 md:shadow-[4px_0_24px_rgba(0,0,0,0.01)]">
      
      {/* 1. Área del Logo: Identidad FONATUR */}
      <Link
        className="group relative mb-4 flex h-20 items-center justify-center rounded-xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md md:mb-6 md:h-40"
        href="/"
      >
        {/* Fondo con el gradiente institucional */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#285C4D] via-[#285C4D] to-[#285C4D]" />

        {/* Línea de acento color Dorado institucional superior */}
        <div className="absolute left-0 top-0 h-1 w-full bg-[#BC955C]" />

        {/* Efecto de resplandor sutil (Shine) */}
        <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />

        {/* Contenedor del Logo */}
        <div className="relative z-10 flex h-full w-full items-center justify-center p-4">
          {/* Aquí controlamos qué tan grande se ve el logo dependiendo de la pantalla */}
          <div className="w-32 sm:w-40 md:w-56 lg:w-[220px]">
            <AcmeLogo />
          </div>
        </div>
      </Link>

      {/* 2. Área de Navegación: Adaptación Mobile (Scroll Horizontal) */}
      {/* Usamos utilidades de Tailwind para ocultar el scrollbar pero permitir hacer "swipe" en móviles */}
      <div className="flex grow flex-row gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex-col md:gap-1.5 md:overflow-visible">
        
        <NavLinks />
        
        {/* Espaciador invisible para empujar el botón de salida al fondo (Solo Desktop) */}
        <div className="hidden h-auto w-full grow md:block"></div>
        
        {/* 3. Acción Destructiva / Salida */}
        {/* shrink-0 evita que el botón se aplaste en móviles si hay muchos enlaces */}
        <form className="mt-auto shrink-0 md:mt-0">
          <button className="group flex h-[48px] w-full items-center justify-center gap-3 rounded-xl p-3 text-sm font-medium text-gray-500 transition-all duration-200 hover:bg-rose-50 hover:text-[#9F2241] active:scale-[0.98] md:justify-start md:px-4">
            <PowerIcon className="w-5 stroke-2 transition-transform duration-200 group-hover:rotate-90 group-hover:scale-110" />
            <span className="hidden transition-colors md:block">Cerrar sesión</span>
          </button>
        </form>
      </div>
    </div>
  );
}


// import Link from 'next/link';
// import NavLinks from '@/app/ui/dashboard/nav-links';
// import AcmeLogo from '@/app/ui/acme-logo';
// import { PowerIcon } from '@heroicons/react/24/outline';

// export default function SideNav() {
//   return (
//     <div className="flex h-full flex-col px-3 py-4 md:px-2">
//       <Link
//         className="mb-2 flex h-20 items-end justify-start rounded-md custom-background2 p-4 md:h-40"
//         href="/"
//       >
//        <div className="w-32 text-white md:w-40">
//           <AcmeLogo />
//         </div>
//       </Link>
//       <div className="flex grow flex-row justify-between space-x-2 md:flex-col md:space-x-0 md:space-y-2">
//         <NavLinks />
//         <div className="hidden h-auto w-full grow rounded-md bg-gray-50 md:block"></div>
//         <form >
//           <button className="flex h-[48px] w-full grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3">
//             <PowerIcon className="w-6" />
//             <div className="hidden md:block">Salir</div>
//           </button>
//         </form>
//       </div>
//     </div>
//   );
// }
