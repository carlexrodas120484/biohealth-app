import { lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Estructura } from '@/components/layout/Estructura';
import Inicio from '@/pages/Inicio';

const AgendarPagina = lazy(() => import('@/pages/AgendarPagina'));
const ServicioDetalle = lazy(() => import('@/pages/ServicioDetalle'));
const Blog = lazy(() => import('@/pages/Blog'));
const Articulo = lazy(() => import('@/pages/Articulo'));
const Privacidad = lazy(() => import('@/pages/Privacidad'));
const NoEncontrada = lazy(() => import('@/pages/NoEncontrada'));

const Router = __HASH_ROUTER__ ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <HelmetProvider>
      <Router>
        <Suspense fallback={<div className="min-h-screen bg-crema" />}>
          <Routes>
            <Route element={<Estructura />}>
              <Route index element={<Inicio />} />
              <Route path="agendar" element={<AgendarPagina />} />
              <Route path="servicios/:id" element={<ServicioDetalle />} />
              <Route path="blog" element={<Blog />} />
              <Route path="blog/:slug" element={<Articulo />} />
              <Route path="privacidad" element={<Privacidad />} />
              <Route path="*" element={<NoEncontrada />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </HelmetProvider>
  );
}
