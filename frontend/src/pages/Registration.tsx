import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, Cpu, Terminal, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { UserRegistrationSchema } from '../utils/validation';
import type { UserRegistrationInput } from '../utils/validation';
import { useWalletStore } from '../stores/useWalletStore';
import { web3Service } from '../services/web3';

export const Registration: React.FC = () => {
  const navigate = useNavigate();
  const { register: registerEnclave, address } = useWalletStore();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [attestationStep, setAttestationStep] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const { register, handleSubmit, formState: { errors } } = useForm<UserRegistrationInput>({
    resolver: zodResolver(UserRegistrationSchema),
    defaultValues: {
      username: '',
      email: '',
      termsApproved: false,
    }
  });

  const attestationLogs = [
    'Initializing Intel SGX Enclave environment...',
    'Generating 256-bit ECDSA cryptographic keypair inside enclave...',
    'Retrieving hardware Quote and Attestation parameters...',
    'Submitting Quote to Intel Attestation Service (IAS) for verification...',
    'IAS Signature verified. Generating SGX Local Attestation token...',
    'Relaying enclave public keys to the SX Registry Smart Contract...',
    'Publishing transaction on-chain. Mining block...',
    'Registry seal complete. Account active!'
  ];

  const onSubmit = async (data: UserRegistrationInput) => {
    setIsRegistering(true);
    setLogs([]);
    
    // Step-by-step attestation simulation
    for (let i = 0; i < attestationLogs.length; i++) {
      setAttestationStep(i);
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${attestationLogs[i]}`]);
      await new Promise((res) => setTimeout(res, 600));
    }

    if (address) {
      await web3Service.registerEnclaveAttestation(data.username, data.email, address);
    }
    
    registerEnclave(data.username, data.email);
    setIsRegistering(false);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#05070f] relative overflow-hidden flex flex-col justify-center items-center p-6">
      
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        
        {/* Branding */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)]">
            <span className="text-xl">🔮</span>
          </div>
          <div>
            <span className="font-extrabold text-base tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent uppercase">SX SECURE</span>
            <span className="block text-[10px] text-indigo-400 font-semibold uppercase tracking-widest mt-0.5">Enclave Seal</span>
          </div>
        </div>

        <Card className="border border-white/10 glow-indigo">
          <CardHeader className="text-center">
            <CardTitle className="flex justify-center items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-400" />
              SX Enclave Registration
            </CardTitle>
            <CardDescription>Seal your user profile in hardware memory prior to marketplace trading</CardDescription>
          </CardHeader>
          
          <CardContent>
            {!isRegistering && attestationStep === null ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                
                <Input
                  label="Username"
                  placeholder="e.g. trader_enclave"
                  error={errors.username?.message}
                  {...register('username')}
                />

                <Input
                  label="Email Address"
                  type="email"
                  placeholder="e.g. trader@domain.com"
                  error={errors.email?.message}
                  {...register('email')}
                />

                {/* Secure notice */}
                <div className="p-3 bg-slate-900/50 border border-white/5 rounded-lg flex gap-2.5 items-start">
                  <Cpu className="h-4.5 w-4.5 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-slate-400 leading-relaxed">
                    <strong>Hardware Attestation Notice:</strong> Your credentials are encrypted and stored solely inside Intel SGX secure memory cells. They are inaccessible even to the marketplace administrators.
                  </div>
                </div>

                {/* Consent checkbox */}
                <div className="flex items-start gap-2.5 pt-2">
                  <input
                    type="checkbox"
                    id="termsApproved"
                    className="mt-1 bg-slate-900 border-white/10 rounded focus:ring-indigo-500 focus:ring-offset-0 text-indigo-600 cursor-pointer h-4 w-4"
                    {...register('termsApproved')}
                  />
                  <label htmlFor="termsApproved" className="text-[11px] text-slate-400 cursor-pointer select-none leading-normal">
                    I authorize the secure enclave to generate local signing keys and verify my browser context signature.
                  </label>
                </div>
                {errors.termsApproved && (
                  <p className="text-[11px] font-medium text-rose-400 mt-1">{errors.termsApproved.message}</p>
                )}

                <Button type="submit" className="w-full mt-4">
                  Seal Account and Register
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin" />
                  <span className="text-xs font-bold text-slate-200">Executing Cryptographic Attestation...</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                    Step {attestationStep !== null ? attestationStep + 1 : 0} of {attestationLogs.length}
                  </span>
                </div>

                {/* Terminal Console */}
                <div className="bg-[#03050c] border border-white/10 rounded-xl p-4 font-mono text-[10px] text-slate-300 h-48 overflow-y-auto space-y-2 select-text">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-bold border-b border-white/5 pb-2 mb-2">
                    <Terminal className="h-3.5 w-3.5" />
                    <span>SGX_ENCLAVE_SYSTEM_CONSOLE v2.4.6</span>
                  </div>
                  {logs.map((log, idx) => (
                    <div key={idx} className={idx === logs.length - 1 ? 'text-indigo-300' : 'text-slate-500'}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};
