import { Router } from 'express';
import { JiraRepository } from '../repositories/jiraRepository.js';
import { RequirementRepository } from '../repositories/requirementRepository.js';
import { jiraPackageGenerationSchema, jiraPackageInputSchema, jiraPackageStatusSchema } from '../schemas/jira.js';
import { mockJiraService } from '../services/jiraService.js';
const repository = new JiraRepository();
const requirementRepository = new RequirementRepository();
export const jiraRouter = Router();
jiraRouter.get('/packages', (_request, response) => response.json({ items: repository.list() }));
jiraRouter.post('/packages', (request, response) => {
    const input = jiraPackageGenerationSchema.safeParse(request.body);
    if (!input.success)
        return response.status(400).json({ error: 'Invalid Jira generation request', details: input.error.flatten() });
    const requirement = requirementRepository.getById(input.data.requirementId);
    if (!requirement)
        return response.status(404).json({ error: 'Requirement not found' });
    if (requirement.status !== 'Approved')
        return response.status(409).json({ error: 'Only approved requirements can generate Jira packages' });
    return response.status(201).json(repository.create(mockJiraService.generate(requirement)));
});
jiraRouter.put('/packages/:id', (request, response) => {
    const input = jiraPackageInputSchema.safeParse({ ...request.body, id: request.params.id });
    if (!input.success)
        return response.status(400).json({ error: 'Invalid Jira package data', details: input.error.flatten() });
    const packageRecord = repository.update(request.params.id, { ...input.data, id: request.params.id, status: input.data.status ?? 'Pending Review' });
    return packageRecord ? response.json(packageRecord) : response.status(404).json({ error: 'Jira package not found' });
});
jiraRouter.patch('/packages/:id/status', (request, response) => {
    const input = jiraPackageStatusSchema.safeParse(request.body);
    if (!input.success)
        return response.status(400).json({ error: 'Invalid Jira package status', details: input.error.flatten() });
    const packageRecord = repository.updateStatus(request.params.id, input.data.status);
    return packageRecord ? response.json(packageRecord) : response.status(404).json({ error: 'Jira package not found' });
});
