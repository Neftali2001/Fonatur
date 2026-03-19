import SideNav from '@/app/ui/dashboard/sidenav';

import { PDFQueueProvider } from '@/app/context/pdf-queue-context';
import PDFQueueButton       from '@/app/ui/PDFQueueButton';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <PDFQueueProvider>
      <div className="flex h-screen flex-col md:flex-row">
        <SideNav />
        <main className="flex-grow p-6 md:overflow-y-auto">{children}</main>
      </div>
      {/* Botón flotante — visible en todas las rutas del dashboard */}
      <PDFQueueButton />
    </PDFQueueProvider>
  );
}




// import SideNav from '@/app/ui/dashboard/sidenav';
 
// export default function Layout({ children }: { children: React.ReactNode }) {
//   return (
//     <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
//       <div className="w-full flex-none md:w-64">
//         <SideNav />
//       </div>
//       <div className="grow p-6 md:overflow-y-auto md:p-12">{children}</div>
//     </div>
//   );
// }