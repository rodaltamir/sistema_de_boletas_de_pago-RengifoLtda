"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, User, Mail, Lock, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Estados de los campos
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");

  // Estados de errores
  const [error, setError] = useState("");

  // Calculador de seguridad de contraseña (0 a 4)
  const calculateStrength = (pass: string) => {
    let score = 0;
    if (!pass) return score;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const strength = calculateStrength(password);
  const strengthColors = ["bg-gray-200", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-teal-500"];
  const strengthLabels = ["", "Muy débil (Agrega más caracteres)", "Débil (Usa mayúsculas y números)", "Aceptable (Sugerimos añadir símbolos)", "¡Contraseña fuerte!"];

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validaciones básicas antes de enviar
    if (!email.includes("@") || !email.includes(".")) {
      setError("Por favor, ingresa un correo electrónico válido.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (!isLogin && strength < 2) {
      setError("Tu contraseña es demasiado débil por seguridad.");
      return;
    }

    try {
      if (isLogin) {
        const res = await fetch(process.env.NEXT_PUBLIC_API_URL || "http://Rengifo_Ltda:8000"/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || "Credenciales incorrectas");
        }

        const data = await res.json();
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("isAdmin", data.is_superuser ? "true" : "false");
        
        router.push("/seleccionar-empresa");
      } else {
        const res = await fetch(process.env.NEXT_PUBLIC_API_URL || "http://Rengifo_Ltda:8000"/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, username, email, password })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || "Error al registrar");
        }

        const data = await res.json();
        setIsLogin(true);
        setError("Registro exitoso. Ahora inicia sesión.");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-teal-900 to-cyan-900 p-4 sm:p-8">
      {/* Contenedor Glassmorphism */}
      <div className="relative w-full max-w-md overflow-hidden bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-[2rem] p-8 sm:p-10">

        {/* Cabecera / Logo */}
        <div className="text-center mb-6 flex flex-col items-center w-full">
          {/* Logo ocupando casi todo el ancho disponible */}
          <div className="w-[90%] h-32 sm:h-40 mb-2 relative drop-shadow-2xl flex items-center justify-center">
            <Image
              src="/logo_rengifo_estandar.png"
              alt="Logo Rengifo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide drop-shadow-sm mt-2">
            {isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
          </h1>
          <p className="text-teal-200/90 mt-2 text-sm font-medium">
            Sistema Integral de Planillas y Boletas de pago
          </p>
        </div>

        {/* Formularios Animados */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isLogin ? "login" : "register"}
            initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <form className="space-y-4" onSubmit={handleAuth}>

              {/* Campos extra para Registro */}
              {!isLogin && (
                <div className="space-y-4">
                  <div className="relative group">
                    <User className="absolute left-4 top-3.5 w-5 h-5 text-white/50 group-focus-within:text-teal-400 transition-colors" />
                    <input
                      type="text"
                      placeholder="Nombre Completo"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 text-white placeholder-white/40 rounded-xl px-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-black/20 transition-all"
                    />
                  </div>
                  <div className="relative group">
                    <User className="absolute left-4 top-3.5 w-5 h-5 text-white/50 group-focus-within:text-teal-400 transition-colors" />
                    <input
                      type="text"
                      placeholder="Nombre de Usuario"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 text-white placeholder-white/40 rounded-xl px-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-black/20 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Email (Común para ambos) */}
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-white/50 group-focus-within:text-teal-400 transition-colors" />
                <input
                  type="email"
                  placeholder="Correo Electrónico"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-white/40 rounded-xl px-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-black/20 transition-all"
                />
              </div>

              {/* Contraseña (Común para ambos) */}
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-white/50 group-focus-within:text-teal-400 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-white/40 rounded-xl px-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-black/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-white/50 hover:text-white transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Medidor de Seguridad de Contraseña y Recomendaciones */}
              {!isLogin && password.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-2 bg-black/20 p-3 rounded-lg border border-white/5"
                >
                  <div className="flex gap-1 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-full flex-1 transition-all duration-500 ${strength >= level ? strengthColors[strength] : "bg-transparent"
                          }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-start gap-2 mt-1">
                    {strength >= 4 ? (
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-white/50 shrink-0 mt-0.5" />
                    )}
                    <p className={`text-xs ${strength >= 4 ? 'text-teal-300' : 'text-white/70'}`}>
                      {strengthLabels[strength]}
                    </p>
                  </div>
                  {strength < 4 && (
                    <ul className="text-[10px] text-white/50 list-disc pl-5 space-y-0.5">
                      <li className={password.length >= 8 ? "text-teal-300" : ""}>Mínimo 8 caracteres</li>
                      <li className={/[A-Z]/.test(password) ? "text-teal-300" : ""}>Al menos una letra mayúscula</li>
                      <li className={/[0-9]/.test(password) ? "text-teal-300" : ""}>Al menos un número</li>
                      <li className={/[^A-Za-z0-9]/.test(password) ? "text-teal-300" : ""}>Al menos un símbolo (ej. !@#$)</li>
                    </ul>
                  )}
                </motion.div>
              )}

              {/* Mensaje de Error global */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-red-500/20 border border-red-500/50 text-red-200 text-sm p-3 rounded-lg flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Botón de Acción Principal */}
              <button
                type="submit"
                className="group relative w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-slate-900 bg-teal-400 hover:bg-teal-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 focus:ring-offset-slate-900 shadow-lg shadow-teal-500/30 transition-all mt-2"
              >
                {isLogin ? "Iniciar Sesión" : "Registrarse como Usuario"}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </motion.div>
        </AnimatePresence>

        {/* Footer Toggle Login/Register */}
        <div className="mt-8 text-center border-t border-white/10 pt-6">
          <p className="text-white/60 text-sm">
            {isLogin ? "¿No tienes una cuenta? " : "¿Ya eres usuario? "}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
                setPassword("");
              }}
              className="font-semibold text-teal-300 hover:text-teal-200 transition-colors"
            >
              {isLogin ? "Regístrate ahora" : "Inicia sesión aquí"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
