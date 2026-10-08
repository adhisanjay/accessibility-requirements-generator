import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { database } from "../src/database/database.js";

describe("A11y Audit API", () => {
  beforeEach(() =>
    database.exec(
      "DELETE FROM jira_tasks; DELETE FROM jira_stories; DELETE FROM jira_epics; DELETE FROM jira_packages; DELETE FROM requirements; DELETE FROM scan_results; DELETE FROM scans; DELETE FROM accessibility_issues; DELETE FROM analysis_suggestions",
    ),
  );

  const createFinding = (title = "Contrast issue") =>
    request(app).post("/api/issues").send({
      title,
      description: "The text has insufficient contrast.",
      wcagCriterion: "1.4.3",
      severity: "high",
      status: "open",
      recommendation: "Increase the text contrast.",
    });

  it("returns a healthy response", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("creates an accessibility issue", async () => {
    const response = await request(app).post("/api/issues").send({
      title: "Low contrast button",
      description: "The button text is difficult to read.",
      wcagCriterion: "1.4.3",
      severity: "high",
      status: "open",
      recommendation: "Increase the text contrast.",
    });
    expect(response.status).toBe(201);
    expect(response.body.title).toBe("Low contrast button");
    expect(response.body.id).toEqual(expect.any(Number));
  });

  it("lists and filters issues", async () => {
    await request(app).post("/api/issues").send({
      title: "Contrast issue",
      description: "Contrast",
      wcagCriterion: "1.4.3",
      severity: "high",
      status: "open",
      recommendation: "Fix contrast.",
    });
    await request(app).post("/api/issues").send({
      title: "Keyboard issue",
      description: "Keyboard",
      wcagCriterion: "2.1.1",
      severity: "medium",
      status: "resolved",
      recommendation: "Add keyboard support.",
    });
    const response = await request(app).get("/api/issues?severity=high");
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].wcagCriterion).toBe("1.4.3");
  });

  it("combines search, severity, and status filters", async () => {
    await request(app).post("/api/issues").send({
      title: "Contrast issue",
      description: "Contrast",
      wcagCriterion: "1.4.3",
      severity: "high",
      status: "open",
      recommendation: "Fix contrast.",
    });
    await request(app).post("/api/issues").send({
      title: "Keyboard issue",
      description: "Keyboard",
      wcagCriterion: "2.1.1",
      severity: "medium",
      status: "resolved",
      recommendation: "Add keyboard support.",
    });

    const resolved = await request(app).get("/api/issues?status=resolved");
    expect(
      resolved.body.items.map((issue: { title: string }) => issue.title),
    ).toEqual(["Keyboard issue"]);

    const combined = await request(app).get(
      "/api/issues?search=Contrast&severity=high&status=open",
    );
    expect(combined.body.total).toBe(1);
    expect(combined.body.items[0].title).toBe("Contrast issue");
  });

  it("deletes an issue", async () => {
    const created = await request(app).post("/api/issues").send({
      title: "Delete me",
      description: "Temporary",
      wcagCriterion: "1.1.1",
      severity: "low",
      status: "open",
      recommendation: "Remove it.",
    });
    const response = await request(app).delete(
      `/api/issues/${created.body.id}`,
    );
    expect(response.status).toBe(204);
    expect((await request(app).get("/api/issues")).body.total).toBe(0);
  });

  it("persists generated suggestions and human review decisions", async () => {
    await createFinding("First finding");
    await createFinding("Second finding");
    const generated = await request(app)
      .post("/api/analysis/suggestions")
      .send({ issueCount: 2, openIssueCount: 1 });
    expect(generated.status).toBe(201);
    expect(generated.body.items).toHaveLength(2);
    expect(generated.body.generatedCount).toBe(2);
    const id = generated.body.items[0].id;

    await request(app)
      .patch(`/api/analysis/suggestions/${id}/status`)
      .send({ status: "Approved" });
    const approved = await request(app).get("/api/analysis/suggestions");
    expect(
      approved.body.items.find((item: { id: string }) => item.id === id).status,
    ).toBe("Approved");

    await request(app)
      .patch(`/api/analysis/suggestions/${id}/status`)
      .send({ status: "Rejected" });
    const rejected = await request(app).get("/api/analysis/suggestions");
    expect(
      rejected.body.items.find((item: { id: string }) => item.id === id).status,
    ).toBe("Rejected");
  });

  it("persists edited suggestion content without affecting issues", async () => {
    await createFinding();
    const generated = await request(app)
      .post("/api/analysis/suggestions")
      .send({ issueCount: 0, openIssueCount: 0 });
    const suggestion = generated.body.items[0];
    const updated = await request(app)
      .put(`/api/analysis/suggestions/${suggestion.id}`)
      .send({ ...suggestion, title: "Updated scan plan", gap: "Updated gap" });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe("Updated scan plan");
    expect(
      (await request(app).get("/api/analysis/suggestions")).body.items[0].gap,
    ).toBe("Updated gap");
    expect((await request(app).get("/api/issues")).body.total).toBe(1);
  });

  it("only generates requirements from approved enhancements", async () => {
    await createFinding("Pending finding");
    await createFinding("Approved finding");
    const generated = await request(app)
      .post("/api/analysis/suggestions")
      .send({ issueCount: 1, openIssueCount: 1 });
    const pendingId = generated.body.items[0].id;
    const blocked = await request(app)
      .post("/api/requirements")
      .send({ enhancementId: pendingId });
    expect(blocked.status).toBe(409);

    const approvedId = generated.body.items[1].id;
    await request(app)
      .patch(`/api/analysis/suggestions/${approvedId}/status`)
      .send({ status: "Approved" });
    const created = await request(app)
      .post("/api/requirements")
      .send({ enhancementId: approvedId });
    expect(created.status).toBe(201);
    expect(created.body.enhancementId).toBe(approvedId);
    expect(created.body.status).toBe("Pending Review");
    expect(created.body.acceptanceCriteria[0]).toContain("Given");
  });

  it("persists requirement edits and review status across retrievals", async () => {
    await createFinding();
    const generated = await request(app)
      .post("/api/analysis/suggestions")
      .send({ issueCount: 0, openIssueCount: 0 });
    const enhancementId = generated.body.items[0].id;
    await request(app)
      .patch(`/api/analysis/suggestions/${enhancementId}/status`)
      .send({ status: "Approved" });
    const created = await request(app)
      .post("/api/requirements")
      .send({ enhancementId });
    const id = created.body.id;

    await request(app)
      .put(`/api/requirements/${id}`)
      .send({
        ...created.body,
        title: "Edited requirement",
        functionalRequirements: ["Edited functional requirement"],
      });
    const edited = await request(app).get("/api/requirements");
    expect(edited.body.items[0].title).toBe("Edited requirement");
    expect(edited.body.items[0].status).toBe("Pending Review");

    await request(app)
      .patch(`/api/requirements/${id}/status`)
      .send({ status: "Approved" });
    expect(
      (await request(app).get("/api/requirements")).body.items[0].status,
    ).toBe("Approved");
    await request(app)
      .patch(`/api/requirements/${id}/status`)
      .send({ status: "Rejected" });
    expect(
      (await request(app).get("/api/requirements")).body.items[0].status,
    ).toBe("Rejected");
  });

  it("generates Jira work items only from approved requirements", async () => {
    await createFinding("Pending Jira finding");
    await createFinding("Approved Jira finding");
    const generated = await request(app)
      .post("/api/analysis/suggestions")
      .send({ issueCount: 0, openIssueCount: 0 });
    const pendingId = generated.body.items[0].id;
    await request(app)
      .patch(`/api/analysis/suggestions/${pendingId}/status`)
      .send({ status: "Approved" });
    const pendingRequirement = await request(app)
      .post("/api/requirements")
      .send({ enhancementId: pendingId });
    expect(
      (await request(app).post("/api/jira/packages").send({ requirementId: pendingRequirement.body.id })).status,
    ).toBe(409);

    const enhancementId = generated.body.items[1].id;
    await request(app)
      .patch(`/api/analysis/suggestions/${enhancementId}/status`)
      .send({ status: "Approved" });
    const requirement = await request(app)
      .post("/api/requirements")
      .send({ enhancementId });
    await request(app)
      .patch(`/api/requirements/${requirement.body.id}/status`)
      .send({ status: "Approved" });
    const created = await request(app)
      .post("/api/jira/packages")
      .send({ requirementId: requirement.body.id });

    expect(created.status).toBe(201);
    expect(created.body.requirementId).toBe(requirement.body.id);
    expect(created.body.epic.id).toContain("-epic");
    expect(created.body.story.epicId).toBe(created.body.epic.id);
    expect(created.body.tasks.length).toBeGreaterThanOrEqual(3);
    expect(created.body.tasks.length).toBeLessThanOrEqual(6);
  });

  it("persists Jira edits and review status", async () => {
    await createFinding();
    const generated = await request(app)
      .post("/api/analysis/suggestions")
      .send({ issueCount: 0, openIssueCount: 0 });
    const enhancementId = generated.body.items[0].id;
    await request(app)
      .patch(`/api/analysis/suggestions/${enhancementId}/status`)
      .send({ status: "Approved" });
    const requirement = await request(app)
      .post("/api/requirements")
      .send({ enhancementId });
    await request(app)
      .patch(`/api/requirements/${requirement.body.id}/status`)
      .send({ status: "Approved" });
    const created = await request(app)
      .post("/api/jira/packages")
      .send({ requirementId: requirement.body.id });

    const edited = await request(app)
      .put(`/api/jira/packages/${created.body.id}`)
      .send({ ...created.body, epic: { ...created.body.epic, summary: "Edited epic" } });
    expect(edited.status).toBe(200);
    expect(edited.body.epic.summary).toBe("Edited epic");
    expect(edited.body.status).toBe("Pending Review");
    await request(app)
      .patch(`/api/jira/packages/${created.body.id}/status`)
      .send({ status: "Approved" });
    const retrieved = await request(app).get("/api/jira/packages");
    expect(retrieved.body.items[0].status).toBe("Approved");
    expect(retrieved.body.items[0].epic.summary).toBe("Edited epic");
  });
});
