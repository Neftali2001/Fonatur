'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Lightbulb, Sparkles, TrashIcon,
  Clock, Brush, Car,
} from 'lucide-react';

type LinkItem = {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const links: LinkItem[] = [
  { name: 'Home',               href: '/dashboard',                    icon: Home      },
  { name: 'Alumbrado público',  href: '/dashboard/Alumbrado_publico',  icon: Lightbulb },
  { name: 'Áreas verdes',       href: '/dashboard/Areas_verdes',       icon: Sparkles  },
  { name: 'Barrido vialidades', href: '/dashboard/Barrido_vialidades', icon: Brush     },
  { name: 'Limpieza Urbana',    href: '/dashboard/Limpieza_Urbana',    icon: TrashIcon },
  { name: 'Vehículo',           href: '/dashboard/vehiculo',           icon: Car       },
  { name: 'Historial',          href: '/dashboard/Historial',          icon: Clock     },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        const LinkIcon = link.icon;
        // Activo si la ruta coincide exactamente, o si es subruta (excepto /dashboard raíz)
        const isActive =
          link.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.name}
            href={link.href}
            className={`
              relative flex h-[48px] shrink-0 grow items-center justify-center gap-2
              rounded-xl p-3 text-sm font-medium transition-all duration-200
              md:flex-none md:justify-start md:px-3
              ${isActive
                ? // ── ACTIVO ──
                  'bg-emerald-50 text-emerald-700 shadow-sm'
                : // ── INACTIVO ──
                  'bg-gray-50 text-gray-500 hover:bg-emerald-50/60 hover:text-emerald-600'
              }
            `}
          >
            {/* Barra lateral verde (solo desktop) */}
            {isActive && (
              <span className="absolute left-0 top-1/2 hidden h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-500 md:block" />
            )}

            {/* Punto indicador (solo mobile, debajo del ícono) */}
            {isActive && (
              <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500 md:hidden" />
            )}

            <LinkIcon
              className={`w-5 h-5 shrink-0 transition-colors ${
                isActive ? 'text-emerald-600' : 'text-gray-400'
              }`}
            />
            <p className={`hidden md:block ${isActive ? 'font-semibold' : ''}`}>
              {link.name}
            </p>
          </Link>
        );
      })}
    </>
  );
}


// import {
//   Home,
//   Lightbulb,
//   Sparkles,
//   TrashIcon ,  // Reemplazo de Trash por Trash2
//   Clock,
//   Brush,
//   Car,  // Uso Brush para limpieza
// } from 'lucide-react';

// type LinkItem = {
//   name: string;
//   href: string;
//   icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
// };

// const links: LinkItem[] = [
//   { name: 'Home', href: '/dashboard', icon: Home },
//   { name: 'Alumbrado publico', href: '/dashboard/Alumbrado_publico', icon: Lightbulb },
//   { name: 'Áreas verdes', href: '/dashboard/Areas_verdes', icon: Sparkles },
//   { name: 'Barrido vialidades', href: '/dashboard/Barrido_vialidades', icon: Brush  },  // Cambié por Brush
//   { name: 'Limpieza Urbana', href: '/dashboard/Limpieza_Urbana', icon: TrashIcon },  // Cambié por Brush
//   { name: 'Vehiculo', href: '/dashboard/vehiculo', icon: Car },
//   { name: 'Historial', href: '/dashboard/Historial', icon: Clock },
// ];

// export default function NavLinks() {
//   return (
//     <>
//       {links.map((link) => {
//         const LinkIcon = link.icon;
//         return (
//           <a
//             key={link.name}
//             href={link.href}
//             className="flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium transition hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3"
//           >
//             <LinkIcon className="w-6 h-6" />
//             <p className="hidden md:block">{link.name}</p>
//           </a>
//         );
//       })}
//     </>
//   );
// }


// import {
//   UserGroupIcon,
//   HomeIcon,
//   DocumentDuplicateIcon,
// } from '@heroicons/react/24/outline';

// // Map of links to display in the side navigation.
// // Depending on the size of the application, this would be stored in a database.
// const links = [
//   { name: 'Home', href: '/dashboard', icon: HomeIcon },
//   { name: 'Alumbrado publico', href: '/dashboard/Alumbrado_publico', icon: UserGroupIcon },
//   { name: 'Areas verdes', href: '/dashboard/Areas_verdes', icon: UserGroupIcon },
//   { name: 'Barrido vialidades', href: '/dashboard/Barrido_vialidades', icon: UserGroupIcon },
//   { name: 'Limpieza Urbana', href: '/dashboard/Limpieza_Urbana', icon: UserGroupIcon },
//    { name: 'Historial', href: '/dashboard/Historial', icon: UserGroupIcon },
// ];

// export default function NavLinks() {
//   return (
//     <>
//       {links.map((link) => {
//         const LinkIcon = link.icon;
//         return (
//           <a
//             key={link.name}
//             href={link.href}
//             className="flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3"
//           >
//             <LinkIcon className="w-6" />
//             <p className="hidden md:block">{link.name}</p>
//           </a>
//         );
//       })}
//     </>
//   );
// }
