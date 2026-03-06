import {
  Home,
  Lightbulb,
  Sparkles,
  TrashIcon ,  // Reemplazo de Trash por Trash2
  Clock,
  Brush,  // Uso Brush para limpieza
} from 'lucide-react';

type LinkItem = {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const links: LinkItem[] = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Alumbrado publico', href: '/dashboard/Alumbrado_publico', icon: Lightbulb },
  { name: 'Áreas verdes', href: '/dashboard/Areas_verdes', icon: Sparkles },
  { name: 'Barrido vialidades', href: '/dashboard/Barrido_vialidades', icon: Brush  },  // Cambié por Brush
  { name: 'Limpieza Urbana', href: '/dashboard/Limpieza_Urbana', icon: TrashIcon },  // Cambié por Brush
  // { name: 'Historial', href: '/dashboard/Historial', icon: Clock },
];

export default function NavLinks() {
  return (
    <>
      {links.map((link) => {
        const LinkIcon = link.icon;
        return (
          <a
            key={link.name}
            href={link.href}
            className="flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium transition hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3"
          >
            <LinkIcon className="w-6 h-6" />
            <p className="hidden md:block">{link.name}</p>
          </a>
        );
      })}
    </>
  );
}


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
