/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  RotateCcw, 
  ChevronRight, 
  Brain, 
  Timer as TimerIcon, 
  AlertCircle,
  CheckCircle2,
  Info,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Point, TrailNumber, TrailResult, PatientInfo, AppState } from './types';

const TRAIL_COUNT = 25;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';

export default function App() {
  const [appState, setAppState] = useState<AppState>('welcome');
  const [currentTrail, setCurrentTrail] = useState<TrailNumber>(1);
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: '',
    gender: '',
    dob: '',
    testDate: new Date().toISOString().split('T')[0],
    referral: '',
    examiner: ''
  });
  
  const [points, setPoints] = useState<Point[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [trailResults, setTrailResults] = useState<TrailResult[]>([]);
  const [showErrorFeedback, setShowErrorFeedback] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Age calculation
  const calculateAge = (dob: string) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Mock conversion for T-Score and Percentile (In real app, use standardized tables)
  const convertToTScore = (rawScore: number, trail: number) => {
    // This is a simplified mock formula for demonstration
    // Lower raw score (time) = Higher T-Score
    const base = trail === 5 ? 120 : 60;
    const tScore = Math.max(15, Math.min(85, Math.round(base - (rawScore / 2) + 50)));
    return tScore;
  };

  const getPercentile = (tScore: number) => {
    // Simplified T-Score to Percentile mapping
    if (tScore >= 70) return 98;
    if (tScore >= 60) return 84;
    if (tScore >= 50) return 50;
    if (tScore >= 40) return 16;
    if (tScore >= 30) return 2;
    return 1;
  };

  const getRating = (tScore: number) => {
    if (tScore >= 70) return 'متفوق جداً';
    if (tScore >= 60) return 'فوق المتوسط';
    if (tScore >= 45) return 'متوسط';
    if (tScore >= 35) return 'تحت المتوسط';
    return 'ضعيف';
  };

  // Statistical calculations
  const getProcessedResults = () => {
    if (trailResults.length < 5) return trailResults;
    const mean = trailResults.reduce((acc, r) => acc + r.tScore, 0) / 5;
    return trailResults.map(r => {
      const diff = r.tScore - mean;
      return {
        ...r,
        diffFromMean: diff,
        isSignificant05: Math.abs(diff) >= 12.38,
        isSignificant01: Math.abs(diff) >= 15.79
      };
    });
  };

  const getCompositeIndex = () => {
    if (trailResults.length < 5) return 0;
    return trailResults.reduce((acc, r) => acc + r.tScore, 0);
  };

  // Generate random points
  const generatePoints = useCallback((trail: TrailNumber) => {
    const newPoints: Point[] = [];
    const labels: string[] = [];

    if (trail < 5) {
      for (let i = 1; i <= TRAIL_COUNT; i++) {
        labels.push(i.toString());
      }
    } else {
      for (let i = 1; i <= 13; i++) {
        labels.push(i.toString());
        if (i < 13) labels.push(ALPHABET[i - 1]);
      }
    }

    const minDistance = 8;
    labels.forEach((label, index) => {
      let x, y, tooClose;
      let attempts = 0;
      do {
        x = 5 + Math.random() * 90;
        y = 5 + Math.random() * 90;
        tooClose = newPoints.some(p => {
          const dx = p.x - x;
          const dy = p.y - y;
          return Math.sqrt(dx * dx + dy * dy) < minDistance;
        });
        attempts++;
      } while (tooClose && attempts < 100);
      newPoints.push({ id: index, label, x, y });
    });
    return newPoints;
  }, []);

  const startTest = (trail: TrailNumber) => {
    const newPoints = generatePoints(trail);
    setPoints(newPoints);
    setCurrentIndex(0);
    setErrors(0);
    setElapsedTime(0);
    setStartTime(Date.now());
    setCurrentTrail(trail);
    setAppState('testing');
  };

  useEffect(() => {
    if (appState === 'testing' && startTime) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [appState, startTime]);

  const handlePointClick = (point: Point) => {
    if (point.id === currentIndex) {
      if (currentIndex === points.length - 1) {
        const finalTime = (Date.now() - (startTime || 0)) / 1000;
        const tScore = convertToTScore(finalTime, currentTrail);
        const result: TrailResult = {
          trailNumber: currentTrail,
          rawScore: finalTime,
          errors,
          tScore,
          percentile: getPercentile(tScore),
          rating: getRating(tScore)
        };
        setTrailResults(prev => [...prev, result]);
        
        if (currentTrail < 5) {
          setCurrentTrail(prev => (prev + 1) as TrailNumber);
          setAppState('instructions');
        } else {
          setAppState('results');
        }
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    } else if (point.id > currentIndex) {
      setErrors(prev => prev + 1);
      setShowErrorFeedback(true);
      setTimeout(() => setShowErrorFeedback(false), 500);
    }
  };

  const resetAll = () => {
    setAppState('welcome');
    setCurrentTrail(1);
    setTrailResults([]);
    setErrors(0);
    setElapsedTime(0);
    setPatientInfo({
      name: '',
      gender: '',
      dob: '',
      testDate: new Date().toISOString().split('T')[0],
      referral: '',
      examiner: ''
    });
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] font-sans text-[#333] selection:bg-[#2c3e50] selection:text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header - High Density Style */}
        <header className="bg-[#2c3e50] text-white p-4 md:p-6 rounded-lg shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold m-0">اختبار توصيل الدوائر الشامل (CTMT)</h1>
            <p className="text-xs opacity-80 mt-1">Comprehensive Trail Making Test - نظام التصحيح والتحليل الآلي</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge className="bg-[#3498db] hover:bg-[#3498db]/90 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              نظام التقييم النيوروسيكولوجي المتكامل
            </Badge>
            {appState === 'testing' && (
              <div className="flex items-center gap-4 bg-white/10 px-4 py-2 rounded-md border border-white/10">
                <div className="text-center">
                  <span className="text-[9px] uppercase tracking-widest opacity-60 block">Trail {currentTrail}</span>
                  <span className="font-mono font-bold text-sm">{elapsedTime}s</span>
                </div>
                <div className="w-px h-6 bg-white/20" />
                <div className="text-center">
                  <span className="text-[9px] uppercase tracking-widest opacity-60 block">Errors</span>
                  <span className="font-mono font-bold text-sm text-red-400">{errors}</span>
                </div>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={resetAll} className="text-white hover:bg-white/10">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          {/* Sidebar - High Density Style */}
          <aside className="space-y-4">
            <Card className="border-[#dcdde1] shadow-sm bg-[#f8f9fa] border-r-4 border-[#2c3e50]">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-[10px] font-bold text-[#2c3e50] uppercase tracking-widest opacity-60">
                  الإشراف العلمي والبرمجة
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-[13px] font-bold text-[#2c3e50]">دكتور. أحمد حمدي عاشور الغول</p>
                <p className="text-[11px] text-[#7f8c8d]">دكتوراه في علم النفس التربوي</p>
              </CardContent>
            </Card>

            {patientInfo.name && (
              <Card className="border-[#dcdde1] shadow-sm bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-[#2c3e50] border-b pb-1">بيانات المفحوص</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-1 text-[12px]">
                  <div className="flex justify-between"><span className="opacity-60">الاسم:</span> <span className="font-bold">{patientInfo.name}</span></div>
                  <div className="flex justify-between"><span className="opacity-60">العمر:</span> <span className="font-bold">{calculateAge(patientInfo.dob)} سنة</span></div>
                  <div className="flex justify-between"><span className="opacity-60">الجنس:</span> <span className="font-bold">{patientInfo.gender === 'male' ? 'ذكر' : 'أنثى'}</span></div>
                </CardContent>
              </Card>
            )}

            <Card className="border-[#dcdde1] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-[#2c3e50] border-b-2 border-[#3498db] pb-2 flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  مكونات CTMT
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-[#555] block">المسارات 1-4 (أرقام)</span>
                  <p className="text-[12px] leading-relaxed opacity-80">تتدرج في الصعوبة البصرية والمكانية باستخدام الأرقام فقط.</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-[#555] block">المسار 5 (أرقام وأحرف)</span>
                  <p className="text-[12px] leading-relaxed opacity-80">التبديل بين الأرقام والحروف (المرونة المعرفية القصوى).</p>
                </div>
                <div className="bg-[#fffaf0] border-r-4 border-[#f39c12] p-3 rounded-sm">
                  <p className="text-[11px] leading-normal">
                    <strong>المؤشر المركب:</strong> يلخص الأداء الكلي عبر المسارات الخمسة لتقييم الكفاءة العصبية.
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content Area */}
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {appState === 'welcome' && (
                <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card className="border-[#dcdde1] shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-xl font-bold text-[#2c3e50]">مرحباً بك في نظام CTMT</CardTitle>
                      <CardDescription>نظام شامل لتقييم الانتباه، المسح البصري، والمرونة المعرفية.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-center">
                          <TimerIcon className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                          <h3 className="font-bold text-sm">دقة زمنية</h3>
                          <p className="text-[11px] opacity-70">حساب الزمن بالثواني لكل مسار بدقة عالية.</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg border border-green-100 text-center">
                          <BarChart className="w-8 h-8 mx-auto mb-2 text-green-600" />
                          <h3 className="font-bold text-sm">تحليل إحصائي</h3>
                          <p className="text-[11px] opacity-70">تحويل الدرجات الخام إلى درجات تائية ورتب مئينية.</p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 text-center">
                          <Brain className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                          <h3 className="font-bold text-sm">دلالة إكلينيكية</h3>
                          <p className="text-[11px] opacity-70">تحديد الفروق الجوهرية والدلالة الإحصائية للأداء.</p>
                        </div>
                      </div>
                      <Button className="w-full h-12 bg-[#2c3e50] text-white font-bold" onClick={() => setAppState('patient-info')}>
                        بدء إدخال بيانات الحالة
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {appState === 'patient-info' && (
                <motion.div key="patient-info" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="border-[#dcdde1] shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold text-[#2c3e50]">القسم الأول: معلومات التعريف (Section I)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold opacity-70">اسم المفحوص</label>
                          <input type="text" className="w-full p-2 border rounded-md" value={patientInfo.name} onChange={e => setPatientInfo({...patientInfo, name: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold opacity-70">تاريخ الميلاد</label>
                          <input type="date" className="w-full p-2 border rounded-md" value={patientInfo.dob} onChange={e => setPatientInfo({...patientInfo, dob: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold opacity-70">الجنس</label>
                          <select className="w-full p-2 border rounded-md" value={patientInfo.gender} onChange={e => setPatientInfo({...patientInfo, gender: e.target.value as any})}>
                            <option value="">اختر...</option>
                            <option value="male">ذكر</option>
                            <option value="female">أنثى</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold opacity-70">تاريخ الاختبار</label>
                          <input type="date" className="w-full p-2 border rounded-md" value={patientInfo.testDate} onChange={e => setPatientInfo({...patientInfo, testDate: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold opacity-70">جهة الإحالة</label>
                          <input type="text" className="w-full p-2 border rounded-md" value={patientInfo.referral} onChange={e => setPatientInfo({...patientInfo, referral: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold opacity-70">اسم الفاحص</label>
                          <input type="text" className="w-full p-2 border rounded-md" value={patientInfo.examiner} onChange={e => setPatientInfo({...patientInfo, examiner: e.target.value})} />
                        </div>
                      </div>
                      <Button className="w-full h-12 bg-[#2c3e50] text-white font-bold" disabled={!patientInfo.name || !patientInfo.dob} onClick={() => setAppState('instructions')}>
                        حفظ البيانات والانتقال للتعليمات
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {appState === 'instructions' && (
                <motion.div key="instructions" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="border-[#dcdde1] shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-xl font-bold text-[#2c3e50]">تعليمات المسار {currentTrail}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-[14px] leading-relaxed">
                        {currentTrail < 5 
                          ? `في هذا المسار (${currentTrail})، قم بتوصيل الدوائر التي تحتوي على الأرقام بترتيب تصاعدي (1، 2، 3...) بأسرع ما يمكن.`
                          : "في المسار الأخير (5)، قم بتوصيل الدوائر بالتبادل بين الأرقام والحروف (1، أ، 2، ب، 3، ج...) بأسرع ما يمكن."}
                      </p>
                      <Button className="w-full h-12 bg-[#2c3e50] text-white font-bold" onClick={() => startTest(currentTrail)}>
                        ابدأ المسار {currentTrail}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {appState === 'testing' && (
                <motion.div key="testing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative w-full aspect-square md:aspect-video bg-white rounded-lg shadow-inner border border-[#dcdde1] overflow-hidden cursor-crosshair">
                  <AnimatePresence>
                    {showErrorFeedback && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-red-500 z-10 pointer-events-none" />}
                  </AnimatePresence>
                  {points.map((point) => (
                    <motion.button key={point.id} className={cn("absolute w-8 h-8 md:w-10 md:h-10 -ml-4 -mt-4 rounded-full border-[1.5px] flex items-center justify-center font-bold text-xs md:text-sm transition-all z-20", point.id < currentIndex ? "bg-[#2c3e50] border-[#2c3e50] text-white" : "bg-white border-[#2c3e50]/40 text-[#2c3e50]/60 hover:border-[#2c3e50]")} style={{ left: `${point.x}%`, top: `${point.y}%` }} onClick={() => handlePointClick(point)} whileTap={{ scale: 0.9 }}>
                      {point.label}
                    </motion.button>
                  ))}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    {points.slice(0, currentIndex).map((point, i) => {
                      if (i === 0) return null;
                      const prev = points[i - 1];
                      return <motion.line key={`line-${i}`} x1={`${prev.x}%`} y1={`${prev.y}%`} x2={`${point.x}%`} y2={`${point.y}%`} stroke="#2c3e50" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />;
                    })}
                  </svg>
                </motion.div>
              )}

              {appState === 'results' && (
                <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {/* Section II: Trail Scores */}
                  <Card className="border-[#dcdde1] shadow-sm">
                    <CardHeader className="bg-[#2c3e50] text-white py-3">
                      <CardTitle className="text-sm font-bold">القسم الثاني: سجل درجات المسارات والمؤشر المركب (Section II)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-[#f8f9fa] border-b">
                              <th className="p-2 border-r text-right">المسار</th>
                              <th className="p-2 border-r text-right">الدرجة الخام (ث)</th>
                              <th className="p-2 border-r text-right">الدرجة التائية (T)</th>
                              <th className="p-2 border-r text-right">الرتبة المئينية</th>
                              <th className="p-2 text-right">الوصف التقييمي</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getProcessedResults().map(r => (
                              <tr key={r.trailNumber} className="border-b">
                                <td className="p-2 border-r font-bold">المسار {r.trailNumber}</td>
                                <td className="p-2 border-r font-mono">{r.rawScore.toFixed(1)}</td>
                                <td className="p-2 border-r font-bold">{r.tScore}</td>
                                <td className="p-2 border-r">{r.percentile}%</td>
                                <td className="p-2">{r.rating}</td>
                              </tr>
                            ))}
                            <tr className="bg-[#2c3e50] text-white font-bold">
                              <td colSpan={2} className="p-2 text-left">مؤشر CTMT المركب (مجموع التائية):</td>
                              <td className="p-2 text-right">{getCompositeIndex()}</td>
                              <td colSpan={2} className="p-2"></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Raw Score Distribution Chart */}
                  <Card className="border-[#dcdde1] shadow-sm">
                    <CardHeader className="py-3 border-b bg-gray-50/50">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <TimerIcon className="w-4 h-4 text-[#2c3e50]" />
                        توزيع الدرجات الخام (الزمن المستغرق بالثواني)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[250px] p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trailResults.map(r => ({ name: `المسار ${r.trailNumber}`, score: parseFloat(r.rawScore.toFixed(1)) }))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis label={{ value: 'الثواني', angle: -90, position: 'insideLeft', fontSize: 10 }} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(value) => [`${value} ثانية`, 'الزمن']} />
                          <Bar dataKey="score" fill="#2c3e50" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <p className="text-[10px] text-center opacity-60 mt-2 italic">يظهر هذا الرسم البياني الاتجاه الزمني للأداء؛ الارتفاع في المسار 5 يعكس العبء المعرفي المضاف.</p>
                    </CardContent>
                  </Card>

                  {/* Section III: Profile Profile */}
                  <Card className="border-[#dcdde1] shadow-sm">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-bold">القسم الثالث: ملف بروفايل الدرجات (Section III)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={getProcessedResults().map(r => ({ name: `T${r.trailNumber}`, score: r.tScore }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis domain={[15, 85]} ticks={[15, 25, 35, 45, 50, 55, 65, 75, 85]} />
                          <Tooltip />
                          <ReferenceLine y={50} stroke="gray" strokeDasharray="3 3" label={{ position: 'right', value: 'المتوسط', fontSize: 10 }} />
                          <Line type="monotone" dataKey="score" stroke="#3498db" strokeWidth={3} dot={{ r: 6, fill: '#2c3e50' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Section IV: Statistical Significance */}
                  <Card className="border-[#dcdde1] shadow-sm">
                    <CardHeader className="bg-[#f8f9fa] py-3">
                      <CardTitle className="text-sm font-bold">القسم الرابع: حساب الدلالة الإحصائية (Section IV)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-[#f8f9fa] border-b">
                              <th className="p-2 border-r text-right">المسار</th>
                              <th className="p-2 border-r text-right">الدرجة التائية</th>
                              <th className="p-2 border-r text-right">المتوسط العام</th>
                              <th className="p-2 border-r text-right">الفرق عن المتوسط</th>
                              <th className="p-2 text-right">الدلالة (Significant)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getProcessedResults().map(r => (
                              <tr key={r.trailNumber} className="border-b">
                                <td className="p-2 border-r">المسار {r.trailNumber}</td>
                                <td className="p-2 border-r">{r.tScore}</td>
                                <td className="p-2 border-r">{(getCompositeIndex() / 5).toFixed(2)}</td>
                                <td className="p-2 border-r font-mono">{r.diffFromMean?.toFixed(2)}</td>
                                <td className="p-2">
                                  {r.isSignificant01 ? <Badge className="bg-red-600 text-[9px]">دال (0.01)</Badge> : 
                                   r.isSignificant05 ? <Badge className="bg-orange-500 text-[9px]">دال (0.05)</Badge> : 
                                   <span className="opacity-40">غير دال</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-center gap-4">
                    <Button className="bg-[#2c3e50] text-white font-bold px-8" onClick={() => window.print()}>طباعة التقرير</Button>
                    <Button variant="outline" className="border-[#2c3e50] text-[#2c3e50] font-bold px-8" onClick={resetAll}>بدء تقييم جديد</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Footer - High Density Style */}
        <footer className="bg-white p-4 rounded-lg border border-[#dcdde1] text-center space-y-2">
          <p className="text-[12px] font-bold text-[#2c3e50]">
            تصميم وبرمجة: دكتور. أحمد حمدي عاشور الغول — دكتوراه في علم النفس التربوي
          </p>
          <p className="text-[10px] text-[#7f8c8d]">
            تم استخلاص هذا الملخص بناءً على المعايير الأكاديمية لاختبارات تتبع المسار (TMT) - المادة مخصصة للأغراض البحثية والعيادية فقط.
          </p>
        </footer>
      </div>
    </div>
  );
}
