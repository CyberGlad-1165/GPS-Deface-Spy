import { motion } from 'framer-motion';
import { Shield, Globe, ScanLine, Bell, ArrowRight, Layers, Zap, Lock, Eye, BarChart3, Radar, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';


const features = [
  { icon: Globe, title: 'Target Acquisition', description: 'Add any website URL and define monitoring regions with pixel-level precision.' },
  { icon: Layers, title: 'Frame-Level Monitoring', description: 'Advanced frame-by-frame analysis to detect even the smallest visual changes.' },
  { icon: ScanLine, title: 'Matrix-Based Detection', description: 'Pixel-grid analysis for precise defacement identification across all elements.' },
  { icon: Bell, title: 'Real-Time Threat Alerts', description: 'Instant critical notifications when defacements are detected on your targets.' },
];

const stats = [
  { value: '99.9%', label: 'Detection Accuracy' },
  { value: '<2s', label: 'Response Time' },
  { value: '24/7', label: 'Monitoring' },
  { value: '500+', label: 'Targets Protected' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center hex-grid">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[128px]"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-[128px]"
        />

        <div className="relative z-10 container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary/10 border border-primary/20 mb-8"
          >
            <Radar className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono text-primary tracking-wider">SECURITY OPERATIONS CENTER</span>
          </motion.div>



          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-5xl md:text-7xl font-bold mb-6 leading-tight font-mono tracking-tight"
          >
            <span className="gradient-text">DEFACE SPY</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10"
          >
            Real-time website defacement detection using advanced
            <span className="text-primary font-medium"> Image Processing</span>,
            <span className="text-primary font-medium"> NLP</span> &
            <span className="text-primary font-medium"> Matrix Analysis</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/dashboard">
              <Button variant="cyber" size="xl" className="group font-mono">
                <Radar className="w-5 h-5" />
                Command Center
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20"
          >
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.05, y: -5 }}
                className="glass-card p-5 cursor-default"
              >
                <div className="text-3xl md:text-4xl font-bold font-mono gradient-text">{stat.value}</div>
                <div className="text-xs font-mono text-muted-foreground mt-1 tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-5 h-8 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-1.5"
          >
            <div className="w-1 h-2.5 rounded-full bg-primary" />
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-24 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold font-mono mb-4 tracking-tight">
              DETECTION <span className="gradient-text">CAPABILITIES</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Comprehensive monitoring using cutting-edge image processing and NLP technologies
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6 }}
                className="glass-card-hover p-6 group"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 relative bg-secondary/20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold font-mono mb-4 tracking-tight">
              HOW IT <span className="gradient-text">WORKS</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: Crosshair, title: 'Acquire Target', desc: 'Enter URL, scan, and select monitoring regions with precision' },
              { step: '02', icon: Zap, title: 'Capture Baseline', desc: 'System captures golden copy as trusted reference point' },
              { step: '03', icon: Lock, title: 'Monitor & Protect', desc: 'Continuous analysis detects any unauthorized changes' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                <div className="glass-card p-8 h-full relative overflow-hidden group hover:border-primary/30 transition-all">
                  <div className="absolute -top-4 -right-4 text-8xl font-bold font-mono text-primary/5 group-hover:text-primary/10 transition-colors">
                    {item.step}
                  </div>
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                      <item.icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                    <p className="text-muted-foreground text-sm">{item.desc}</p>
                  </div>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 text-primary/50">
                    <ArrowRight className="w-8 h-8" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="container mx-auto px-6 text-center"
        >
          <h2 className="text-3xl md:text-5xl font-bold font-mono mb-6 tracking-tight">
            READY TO <span className="gradient-text">PROTECT?</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-10">
            Deploy Deface Spy on your targets and get real-time defacement detection
          </p>
          <Link to="/dashboard">
            <Button variant="cyber" size="xl" className="group font-mono">
              Launch Command Center
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-primary" />
            <span className="font-bold font-mono text-sm tracking-wider">DEFACE SPY</span>
          </div>
          <p className="text-xs font-mono text-muted-foreground tracking-wider">
            © 2026 DEFACE SPY • WEB DEFACEMENT MONITORING
          </p>
        </div>
      </footer>
    </div>
  );
}
