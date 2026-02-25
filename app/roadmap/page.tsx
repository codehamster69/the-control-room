import Link from "next/link";
import {
  ArrowLeft,
  Compass,
  Crosshair,
  Package,
  Trophy,
  Users,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const gameplayPhases = [
  {
    title: "Phase A — Early Game (Day 1–3)",
    color: "#ffc800",
    progress: 30,
    bullets: [
      "Prioritize your free hunt every time it is available.",
      "Build rhythm: run → collect → reinvest.",
      "Avoid draining berries too early.",
    ],
  },
  {
    title: "Phase B — Growth (Week 1)",
    color: "#00ffff",
    progress: 60,
    bullets: [
      "Use paid hunts once token flow is stable.",
      "Upgrade order: items/hour → runtime → cost/hour → satellite.",
      "Focus on compounding instead of one-off gains.",
    ],
  },
  {
    title: "Phase C — Optimization (Week 2+)",
    color: "#ff00ff",
    progress: 90,
    bullets: [
      "Balance free and paid hunts around your schedule.",
      "Buy upgrades in chunks for stronger jumps.",
      "Keep hunt uptime as close to 24/7 as possible.",
    ],
  },
];

const weeklyPlan = [
  {
    icon: Compass,
    title: "Daily",
    items: [
      "Claim free hunt",
      "Run profitable paid hunts",
      "Collect completed sessions",
    ],
  },
  {
    icon: Package,
    title: "Every 2–3 Days",
    items: ["Review armory", "Sell planned surplus", "Reinvest upgrades"],
  },
  {
    icon: CalendarDays,
    title: "Weekly",
    items: [
      "Check global + monthly trend",
      "Solve bottlenecks (items/hour, runtime, cost)",
      "Set next upgrade target",
    ],
  },
];

export default function RoadmapPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1
              className="text-xl md:text-3xl font-bold"
              style={{
                fontFamily: "'Press Start 2P', cursive",
                color: "#ff00ff",
                textShadow: "0 0 2px #ff00ff",
              }}
            >
              GAME ROADMAP
            </h1>
            <p className="mt-3 text-gray-300 font-mono text-sm">
              How to play, progress, and rank up efficiently in The Control Room.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="border-cyan-500/50 text-cyan-300 bg-transparent hover:bg-cyan-500/10"
          >
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back Home
            </Link>
          </Button>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: Compass,
              label: "First-time Setup",
              accent: "#00ffff",
              desc: "Sign in, verify Instagram, unlock routes.",
            },
            {
              icon: Crosshair,
              label: "Hunt Loop",
              accent: "#ffc800",
              desc: "Run hunts, collect, reinvest, repeat.",
            },
            {
              icon: Trophy,
              label: "Ranking Push",
              accent: "#ffff00",
              desc: "Track monthly + global leaderboard climbs.",
            },
            {
              icon: Users,
              label: "Community",
              accent: "#00ff00",
              desc: "Build social momentum and profile power.",
            },
          ].map((item) => (
            <Card
              key={item.label}
              className="bg-black/50 border"
              style={{ borderColor: `${item.accent}66` }}
            >
              <CardHeader className="pb-2">
                <item.icon className="w-8 h-8" style={{ color: item.accent }} />
                <CardTitle className="text-sm font-mono" style={{ color: item.accent }}>
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-300 font-mono">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-cyan-300 font-mono text-lg">Progression Strategy</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {gameplayPhases.map((phase) => (
              <Card
                key={phase.title}
                className="bg-black/40 border"
                style={{ borderColor: `${phase.color}66` }}
              >
                <CardHeader>
                  <CardTitle className="text-sm font-mono" style={{ color: phase.color }}>
                    {phase.title}
                  </CardTitle>
                  <Progress value={phase.progress} className="h-2" />
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {phase.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="text-xs font-mono text-gray-300 flex items-start gap-2"
                      >
                        <span style={{ color: phase.color }}>▸</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {weeklyPlan.map((block) => (
            <Card key={block.title} className="bg-black/50 border-green-500/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <block.icon className="w-5 h-5 text-green-400" />
                  <CardTitle className="font-mono text-green-300 text-sm">
                    {block.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {block.items.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-2 text-xs text-gray-300 font-mono"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-green-400" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="bg-black/60 border-pink-500/40">
          <CardHeader>
            <CardTitle className="text-pink-300 font-mono text-base">
              Golden Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs font-mono text-gray-200">
            <Badge variant="outline" className="border-pink-400 text-pink-300">
              Never leave completed hunts uncollected.
            </Badge>
            <Badge variant="outline" className="border-cyan-400 text-cyan-300">
              Reinvest early for compounding growth.
            </Badge>
            <Badge variant="outline" className="border-yellow-400 text-yellow-300">
              Use selling strategically, not emotionally.
            </Badge>
            <Badge variant="outline" className="border-green-400 text-green-300">
              Consistency beats short spikes.
            </Badge>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
