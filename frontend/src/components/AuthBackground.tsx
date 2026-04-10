import { useEffect, useRef } from 'react';

/**
 * Animated background for auth pages — gradient mesh + floating particles.
 * Renders on a full-screen canvas behind the auth card.
 */
export default function AuthBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        let particles: Particle[] = [];

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        // Particle class
        interface Particle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            radius: number;
            opacity: number;
            opacityDir: number;
            color: string;
        }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        const colors = isDark ? [
            'rgba(74, 222, 128,',   // accent green
            'rgba(129, 140, 248,',  // indigo
            'rgba(56, 189, 248,',   // sky blue
            'rgba(167, 139, 250,',  // violet
        ] : [
            'rgba(22, 163, 74,',    // accent green (darker)
            'rgba(79, 70, 229,',    // indigo (darker)
            'rgba(2, 132, 199,',    // sky blue (darker)
            'rgba(124, 58, 237,',   // violet (darker)
        ];

        // Create particles
        const count = Math.min(Math.floor(window.innerWidth / 25), 50);
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                radius: Math.random() * 2 + 0.5,
                opacity: Math.random() * 0.5 + 0.1,
                opacityDir: (Math.random() - 0.5) * 0.005,
                color: colors[Math.floor(Math.random() * colors.length)],
            });
        }

        // Gradient orbs — slow-moving colored blobs
        const orbs = isDark ? [
            { x: 0.25, y: 0.3, radius: 350, color: 'rgba(74, 222, 128, 0.06)', speed: 0.0003, offset: 0 },
            { x: 0.75, y: 0.7, radius: 400, color: 'rgba(129, 140, 248, 0.05)', speed: 0.0002, offset: 2 },
            { x: 0.5, y: 0.2, radius: 300, color: 'rgba(56, 189, 248, 0.04)', speed: 0.00025, offset: 4 },
            { x: 0.3, y: 0.8, radius: 280, color: 'rgba(167, 139, 250, 0.04)', speed: 0.00035, offset: 1 },
        ] : [
            { x: 0.25, y: 0.3, radius: 350, color: 'rgba(22, 163, 74, 0.04)', speed: 0.0003, offset: 0 },
            { x: 0.75, y: 0.7, radius: 400, color: 'rgba(79, 70, 229, 0.03)', speed: 0.0002, offset: 2 },
            { x: 0.5, y: 0.2, radius: 300, color: 'rgba(2, 132, 199, 0.03)', speed: 0.00025, offset: 4 },
            { x: 0.3, y: 0.8, radius: 280, color: 'rgba(124, 58, 237, 0.03)', speed: 0.00035, offset: 1 },
        ];

        let time = 0;

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            time++;

            // Draw gradient orbs
            for (const orb of orbs) {
                const cx = canvas.width * (orb.x + Math.sin(time * orb.speed + orb.offset) * 0.1);
                const cy = canvas.height * (orb.y + Math.cos(time * orb.speed * 0.7 + orb.offset) * 0.1);
                const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, orb.radius);
                gradient.addColorStop(0, orb.color);
                gradient.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // Draw and update particles
            for (const p of particles) {
                p.x += p.vx;
                p.y += p.vy;
                p.opacity += p.opacityDir;

                if (p.opacity <= 0.05 || p.opacity >= 0.6) p.opacityDir *= -1;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = `${p.color} ${p.opacity})`;
                ctx.fill();
            }

            // Draw connections between nearby particles
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        const opacity = (1 - dist / 120) * 0.08;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(74, 222, 128, ${opacity})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            animationId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 0 }}
        />
    );
}
