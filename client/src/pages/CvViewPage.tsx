import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Loader2, Mail, Phone, Linkedin, MapPin, Calendar, Award, Briefcase, GraduationCap, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, buildUrl } from "@shared/routes";
import { GeneratedCvResponse } from "@shared/schema";

interface CvData {
  personalInfo: {
    name: string;
    title: string;
    email: string;
    phone: string;
    linkedin?: string;
    location?: string;
  };
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    location: string;
    duration: string;
    description: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    location: string;
    duration: string;
  }>;
  skills: string[];
}

export default function CvViewPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [cvData, setCvData] = useState<GeneratedCvResponse | null>(null);
  const [parsedCvData, setParsedCvData] = useState<CvData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCvData = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        const response = await fetch(`/api/resumes/${id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch CV data');
        }

        const data: GeneratedCvResponse = await response.json();
        setCvData(data);

        // Parse the HTML content to extract structured data
        if (data.pdfUrl) {
          // For now, we'll create mock data based on the template
          // In a real implementation, you'd parse the actual CV content
          const mockParsedData: CvData = {
            personalInfo: {
              name: "John Doe",
              title: "Senior Software Engineer",
              email: "john.doe@example.com",
              phone: "+1 (555) 123-4567",
              linkedin: "linkedin.com/in/johndoe",
              location: "San Francisco, CA"
            },
            summary: "Experienced software engineer with 8+ years in full-stack development, specializing in React, Node.js, and cloud architectures. Passionate about building scalable applications and leading cross-functional teams.",
            experience: [
              {
                title: "Senior Software Engineer",
                company: "Tech Corp",
                location: "San Francisco, CA",
                duration: "2020 - Present",
                description: [
                  "Led development of microservices architecture serving 1M+ users",
                  "Reduced API response times by 40% through optimization",
                  "Mentored junior developers and conducted code reviews"
                ]
              },
              {
                title: "Software Engineer",
                company: "StartupXYZ",
                location: "New York, NY",
                duration: "2018 - 2020",
                description: [
                  "Built React-based dashboard with real-time data visualization",
                  "Implemented CI/CD pipelines reducing deployment time by 60%",
                  "Collaborated with product team to define technical requirements"
                ]
              }
            ],
            education: [
              {
                degree: "Bachelor of Science in Computer Science",
                institution: "University of Technology",
                location: "Boston, MA",
                duration: "2014 - 2018"
              }
            ],
            skills: ["JavaScript", "TypeScript", "React", "Node.js", "Python", "AWS", "Docker", "PostgreSQL", "MongoDB"]
          };
          setParsedCvData(mockParsedData);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load CV';
        setError(errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCvData();
  }, [id, toast]);

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleGoBack = () => {
    setLocation("/my-resumes");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your CV...</p>
        </div>
      </div>
    );
  }

  if (error || !parsedCvData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-4">CV Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || "The CV you're looking for doesn't exist or couldn't be loaded."}</p>
          <button
            onClick={handleGoBack}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Resumes
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Floating Action Bar */}
      <div className="fixed top-4 right-4 z-50 flex gap-2 print:hidden">
        <button
          onClick={handleGoBack}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg shadow-lg hover:shadow-xl transition-shadow"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg hover:shadow-xl transition-shadow"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>

      {/* Main Content */}
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* A4 Document Container */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white shadow-xl rounded-lg overflow-hidden"
            style={{ minHeight: '297mm' }}
          >
            <div className="p-8 space-y-8">
              {/* Header Section */}
              <div className="border-b border-border pb-6">
                <h1 className="text-3xl font-bold text-foreground mb-2" style={{ fontSize: '24pt' }}>
                  {parsedCvData.personalInfo.name}
                </h1>
                <p className="text-xl text-muted-foreground mb-4" style={{ fontSize: '16pt' }}>
                  {parsedCvData.personalInfo.title}
                </p>
                
                <div className="flex flex-wrap gap-4 text-sm" style={{ fontSize: '11pt' }}>
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4 text-primary" />
                    <span>{parsedCvData.personalInfo.email}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4 text-primary" />
                    <span>{parsedCvData.personalInfo.phone}</span>
                  </div>
                  {parsedCvData.personalInfo.linkedin && (
                    <div className="flex items-center gap-1">
                      <Linkedin className="w-4 h-4 text-primary" />
                      <span>{parsedCvData.personalInfo.linkedin}</span>
                    </div>
                  )}
                  {parsedCvData.personalInfo.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>{parsedCvData.personalInfo.location}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Professional Summary */}
              <div>
                <h2 className="text-lg font-semibold text-foreground uppercase tracking-wide mb-3" style={{ fontSize: '14pt' }}>
                  Professional Summary
                </h2>
                <p className="text-muted-foreground leading-relaxed" style={{ fontSize: '11pt' }}>
                  {parsedCvData.summary}
                </p>
              </div>

              {/* Experience Section */}
              <div>
                <h2 className="text-lg font-semibold text-foreground uppercase tracking-wide mb-4 flex items-center gap-2" style={{ fontSize: '14pt' }}>
                  <Briefcase className="w-5 h-5" />
                  Professional Experience
                </h2>
                <div className="space-y-6">
                  {parsedCvData.experience.map((exp, index) => (
                    <div key={index} className="relative">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-foreground" style={{ fontSize: '12pt' }}>
                            {exp.title}
                          </h3>
                          <p className="text-primary font-medium" style={{ fontSize: '11pt' }}>
                            {exp.company}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground" style={{ fontSize: '10pt' }}>
                            {exp.location}
                          </p>
                          <p className="text-sm text-muted-foreground" style={{ fontSize: '10pt' }}>
                            {exp.duration}
                          </p>
                        </div>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground" style={{ fontSize: '11pt' }}>
                        {exp.description.map((desc, descIndex) => (
                          <li key={descIndex}>{desc}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Education Section */}
              <div>
                <h2 className="text-lg font-semibold text-foreground uppercase tracking-wide mb-4 flex items-center gap-2" style={{ fontSize: '14pt' }}>
                  <GraduationCap className="w-5 h-5" />
                  Education
                </h2>
                <div className="space-y-4">
                  {parsedCvData.education.map((edu, index) => (
                    <div key={index} className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-foreground" style={{ fontSize: '12pt' }}>
                          {edu.degree}
                        </h3>
                        <p className="text-primary font-medium" style={{ fontSize: '11pt' }}>
                          {edu.institution}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground" style={{ fontSize: '10pt' }}>
                          {edu.location}
                        </p>
                        <p className="text-sm text-muted-foreground" style={{ fontSize: '10pt' }}>
                          {edu.duration}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skills Section */}
              <div>
                <h2 className="text-lg font-semibold text-foreground uppercase tracking-wide mb-4 flex items-center gap-2" style={{ fontSize: '14pt' }}>
                  <Award className="w-5 h-5" />
                  Technical Skills
                </h2>
                <div className="flex flex-wrap gap-2">
                  {parsedCvData.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm"
                      style={{ fontSize: '10pt' }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Print Optimization Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body {
              background: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .print\\:hidden {
              display: none !important;
            }
            
            .bg-slate-50 {
              background: white !important;
            }
            
            .shadow-xl {
              box-shadow: none !important;
            }
            
            .rounded-lg {
              border-radius: 0 !important;
            }
            
            @page {
              margin: 0;
              size: A4;
            }
          }
        `
      }} />
    </>
  );
}
