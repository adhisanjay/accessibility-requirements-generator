import { Router } from 'express';
import { issueInputSchema, issueQuerySchema } from '../schemas/issue.js';
import { IssueRepository } from '../repositories/issueRepository.js';

const repository = new IssueRepository();
export const issueRouter = Router();

const parseId = (value: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

issueRouter.get('/', (request, response) => {
  const query = issueQuerySchema.safeParse(request.query);
  if (!query.success) return response.status(400).json({ error: 'Invalid issue filters', details: query.error.flatten() });
  return response.json(repository.list(query.data));
});

issueRouter.get('/summary', (_request, response) => response.json(repository.summary()));

issueRouter.get('/:id', (request, response) => {
  const id = parseId(request.params.id);
  const issue = id ? repository.getById(id) : null;
  return issue ? response.json(issue) : response.status(404).json({ error: 'Issue not found' });
});

issueRouter.post('/', (request, response) => {
  const input = issueInputSchema.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: 'Invalid issue data', details: input.error.flatten() });
  return response.status(201).json(repository.create(input.data));
});

issueRouter.put('/:id', (request, response) => {
  const id = parseId(request.params.id);
  const input = issueInputSchema.safeParse(request.body);
  if (!id || !input.success) return response.status(400).json({ error: 'Invalid issue data', details: input.success ? undefined : input.error.flatten() });
  const issue = repository.update(id, input.data);
  return issue ? response.json(issue) : response.status(404).json({ error: 'Issue not found' });
});

issueRouter.delete('/:id', (request, response) => {
  const id = parseId(request.params.id);
  if (!id || !repository.delete(id)) return response.status(404).json({ error: 'Issue not found' });
  return response.status(204).send();
});
