import { useSidebar } from '@/components/ui/sidebar';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, PanelLeft } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <span>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Card({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="bg-card text-card-foreground rounded-lg overflow-hidden border border-border w-64">
      <div className="h-32 bg-gradient-to-br from-muted to-muted-foreground/20" />
      <div className="p-3 space-y-1">
        <div className="text-sm font-medium truncate">{title}</div>
        {subtitle ? (
          <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function Home() {
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <>
      <TopLeftLogoTrigger />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-10">
        <div className="text-2xl font-semibold text-center mb-2">{greeting}</div>
        <Section title="Recently visited" action={<Link to="#" className="text-xs text-muted-foreground inline-flex items-center gap-1">See all <ChevronRight className="size-3" /></Link>}>
          <Carousel className="w-full" wheelGestures>
            <CarouselContent className="-ml-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <CarouselItem key={i} className="pl-2 basis-auto">
                  <Card title={`SAAS Demo ${i + 1}`} subtitle={`Nov ${i + 1}`} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </Section>

        <Section title="Learn" action={<Link to="#" className="text-xs text-muted-foreground inline-flex items-center gap-1">See all <ChevronRight className="size-3" /></Link>}>
          <Carousel className="w-full" wheelGestures>
            <CarouselContent className="-ml-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <CarouselItem key={i} className="pl-2 basis-auto">
                  <Card title={["The ultimate guide","Customize & style","Getting started","Using AI effectively"][i % 4]} subtitle={`${5 + (i % 5)}m read`} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </Section>

        <Section title="Featured templates" action={<Link to="#" className="text-xs text-muted-foreground inline-flex items-center gap-1">See all <ChevronRight className="size-3" /></Link>}>
          <Carousel className="w-full" wheelGestures>
            <CarouselContent className="-ml-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <CarouselItem key={i} className="pl-2 basis-auto">
                  <Card title={["Life Wiki","Journal","To-do List","Simple Budget"][i % 4]} subtitle="By Quild" />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </Section>
      </div>
    </>
  );
}

function TopLeftLogoTrigger() {
  const { toggleSidebar, state } = useSidebar();
  // Hide when sidebar is expanded (logo already visible in sidebar)
  if (state === 'expanded') return null;
  return (
    <div className="sticky top-0 z-20 h-12 pl-3 flex items-center">
      <button
        aria-label="Toggle sidebar"
        className="group inline-flex items-center"
        onClick={toggleSidebar}
      >
        <img src="/logo.svg" alt="Quild AI" className="h-6 w-auto dark:invert block group-hover:hidden" />
        <PanelLeft className="size-4 hidden group-hover:block" />
      </button>
    </div>
  );
}
