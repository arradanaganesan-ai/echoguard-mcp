import { z } from 'zod';

export const HazardTypeSchema = z.enum([
  'suspected_gas_leak',
  'smoke_fire',
  'medical_distress',
  'electrical_hazard',
  'benign_or_unknown',
]);

export const RiskLevelSchema = z.enum(['CRITICAL', 'HIGH', 'MODERATE', 'LOW']);

export const CreateIncidentSchema = z.object({
  report: z.string().min(3, 'Incident report must be at least 3 characters long'),
  scenarioId: z.string().optional(),
  locationHint: z.string().optional(),
  occupantsHint: z.string().optional(),
});

export const AssessIncidentSchema = z.object({
  incidentId: z.string().min(1, 'incidentId is required'),
});

export const SafetyGuidanceSchema = z.object({
  hazard: HazardTypeSchema,
  symptoms: z.array(z.string()).default([]),
});

export const PrepareNotificationSchema = z.object({
  incidentId: z.string().min(1, 'incidentId is required'),
  recipientType: z.enum(['emergency_services', 'gas_utility', 'emergency_contact', 'building_management']),
  recipientName: z.string().min(1),
  contactInfo: z.string().optional(),
});

export const SimulateActionSchema = z.object({
  incidentId: z.string().min(1, 'incidentId is required'),
  actionType: z.string().min(1),
  target: z.string().min(1),
  parameters: z.record(z.string(), z.any()).optional(),
});

export const IncidentIdParamSchema = z.object({
  incidentId: z.string().min(1),
});
