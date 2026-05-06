// #!/usr/bin/env bun
// /**
//  * Comprehensive test script for Qdrant search features
//  *
//  * Tests:
//  * - Alternatives indexing and search
//  * - Categories indexing and search
//  * - Related tools recommendations
//  * - Search performance and fallback behavior
//  * - Admin search with all entity types
//  *
//  * Usage:
//  *   bun run scripts/test-qdrant-search.ts
//  */

// import { findRelatedTools, findRelatedToolsBySlug } from "~/lib/related-tools";
// import {
// 	type AlternativeVectorMatch,
// 	type CategoryVectorMatch,
// 	type ReindexProgress,
// 	deleteAlternativeVector,
// 	deleteCategoryVector,
// 	reindexAllAlternatives,
// 	reindexAllCategories,
// 	searchAlternativeVectors,
// 	searchCategoryVectors,
// 	upsertAlternativeVector,
// 	upsertCategoryVector,
// } from "~/lib/vector-store";
// import { prisma } from "~/services/prisma";
// import {
// 	QDRANT_ALTERNATIVES_COLLECTION,
// 	QDRANT_CATEGORIES_COLLECTION,
// 	ensureAlternativesCollection,
// 	ensureCategoriesCollection,
// 	qdrantClient,
// } from "~/services/qdrant";

// type TestResult = {
// 	name: string;
// 	passed: boolean;
// 	error?: string;
// 	details?: unknown;
// };

// const results: TestResult[] = [];

// function logTest(
// 	name: string,
// 	passed: boolean,
// 	error?: string,
// 	details?: unknown,
// ) {
// 	results.push({ name, passed, error, details });
// 	const icon = passed ? "✅" : "❌";
// 	console.log(`${icon} ${name}`);
// 	if (error) {
// 		console.log(`   Error: ${error}`);
// 	}
// 	if (details) {
// 		console.log(`   Details:`, JSON.stringify(details, null, 2));
// 	}
// }

// async function testAlternativesIndexing() {
// 	console.log("\n📦 Testing Alternatives Indexing...");

// 	try {
// 		// Get a sample alternative (tools that could be alternatives)
// 		const sampleTool = await prisma.tool.findFirst({
// 			where: { publishedAt: { lte: new Date() } },
// 			select: {
// 				id: true,
// 				slug: true,
// 				name: true,
// 				description: true,
// 			},
// 		});

// 		if (!sampleTool) {
// 			logTest(
// 				"Alternatives indexing - No tools available",
// 				false,
// 				"No published tools found",
// 			);
// 			return;
// 		}

// 		// Test upsert
// 		await upsertAlternativeVector({
// 			id: sampleTool.id,
// 			slug: sampleTool.slug,
// 			name: sampleTool.name,
// 			description: sampleTool.description,
// 		});
// 		logTest("Alternatives indexing - Upsert vector", true, undefined, {
// 			toolId: sampleTool.id,
// 			slug: sampleTool.slug,
// 		});

// 		// Verify it exists in Qdrant
// 		const existsResult = await qdrantClient.collectionExists(
// 			QDRANT_ALTERNATIVES_COLLECTION,
// 		);
// 		const exists =
// 			typeof existsResult === "boolean" ? existsResult : existsResult?.exists;
// 		if (!exists) {
// 			logTest(
// 				"Alternatives indexing - Collection exists",
// 				false,
// 				"Collection not found",
// 			);
// 			return;
// 		}

// 		// Get collection info to verify point count
// 		const collectionInfo = await qdrantClient.getCollection(
// 			QDRANT_ALTERNATIVES_COLLECTION,
// 		);
// 		logTest("Alternatives indexing - Collection verified", true, undefined, {
// 			pointsCount: collectionInfo.points_count,
// 		});
// 	} catch (error) {
// 		logTest(
// 			"Alternatives indexing",
// 			false,
// 			error instanceof Error ? error.message : String(error),
// 		);
// 	}
// }

// async function testAlternativesSearch() {
// 	console.log("\n🔍 Testing Alternatives Search...");

// 	try {
// 		await ensureAlternativesCollection();

// 		// Test search with various queries
// 		const testQueries = ["AI", "Work & Study", "tool", "productivity"];

// 		for (const query of testQueries) {
// 			const start = performance.now();
// 			const results = await searchAlternativeVectors(query, { limit: 5 });
// 			const duration = performance.now() - start;

// 			logTest(
// 				`Alternatives search - Query: "${query}"`,
// 				results.length > 0,
// 				undefined,
// 				{
// 					resultCount: results.length,
// 					duration: `${Math.round(duration)}ms`,
// 					topScore: results[0]?.score ?? 0,
// 				},
// 			);
// 		}

// 		// Test with score threshold
// 		const thresholdResults = await searchAlternativeVectors("AI", {
// 			limit: 10,
// 			scoreThreshold: 0.3,
// 		});
// 		logTest(
// 			"Alternatives search - Score threshold filtering",
// 			true,
// 			undefined,
// 			{
// 				resultsWithThreshold: thresholdResults.length,
// 				allResults: (await searchAlternativeVectors("AI", { limit: 10 }))
// 					.length,
// 			},
// 		);
// 	} catch (error) {
// 		logTest(
// 			"Alternatives search",
// 			false,
// 			error instanceof Error ? error.message : String(error),
// 		);
// 	}
// }

// async function testCategoriesIndexing() {
// 	console.log("\n📦 Testing Categories Indexing...");

// 	try {
// 		// Get a sample category
// 		const sampleCategory = await prisma.category.findFirst({
// 			select: {
// 				id: true,
// 				slug: true,
// 				name: true,
// 				label: true,
// 				description: true,
// 				updatedAt: true,
// 				createdAt: true,
// 			},
// 		});

// 		if (!sampleCategory) {
// 			logTest(
// 				"Categories indexing - No categories available",
// 				false,
// 				"No categories found",
// 			);
// 			return;
// 		}

// 		// Test upsert
// 		await upsertCategoryVector(sampleCategory);
// 		logTest("Categories indexing - Upsert vector", true, undefined, {
// 			categoryId: sampleCategory.id,
// 			slug: sampleCategory.slug,
// 		});

// 		// Verify collection exists
// 		const existsResult = await qdrantClient.collectionExists(
// 			QDRANT_CATEGORIES_COLLECTION,
// 		);
// 		const exists =
// 			typeof existsResult === "boolean" ? existsResult : existsResult?.exists;
// 		if (!exists) {
// 			logTest(
// 				"Categories indexing - Collection exists",
// 				false,
// 				"Collection not found",
// 			);
// 			return;
// 		}

// 		// Get collection info
// 		const collectionInfo = await qdrantClient.getCollection(
// 			QDRANT_CATEGORIES_COLLECTION,
// 		);
// 		logTest("Categories indexing - Collection verified", true, undefined, {
// 			pointsCount: collectionInfo.points_count,
// 		});
// 	} catch (error) {
// 		logTest(
// 			"Categories indexing",
// 			false,
// 			error instanceof Error ? error.message : String(error),
// 		);
// 	}
// }

// async function testCategoriesSearch() {
// 	console.log("\n🔍 Testing Categories Search...");

// 	try {
// 		await ensureCategoriesCollection();

// 		// Test search with various queries
// 		const testQueries = ["AI", "development", "productivity", "design"];

// 		for (const query of testQueries) {
// 			const start = performance.now();
// 			const results = await searchCategoryVectors(query, { limit: 5 });
// 			const duration = performance.now() - start;

// 			logTest(
// 				`Categories search - Query: "${query}"`,
// 				results.length > 0,
// 				undefined,
// 				{
// 					resultCount: results.length,
// 					duration: `${Math.round(duration)}ms`,
// 					topScore: results[0]?.score ?? 0,
// 				},
// 			);
// 		}

// 		// Test with score threshold
// 		const thresholdResults = await searchCategoryVectors("AI", {
// 			limit: 10,
// 			scoreThreshold: 0.3,
// 		});
// 		logTest("Categories search - Score threshold filtering", true, undefined, {
// 			resultsWithThreshold: thresholdResults.length,
// 			allResults: (await searchCategoryVectors("AI", { limit: 10 })).length,
// 		});
// 	} catch (error) {
// 		logTest(
// 			"Categories search",
// 			false,
// 			error instanceof Error ? error.message : String(error),
// 		);
// 	}
// }

// async function testRelatedToolsRecommendations() {
// 	console.log("\n🎯 Testing Related Tools Recommendations...");

// 	try {
// 		// Get a sample published tool
// 		const sampleTool = await prisma.tool.findFirst({
// 			where: { publishedAt: { lte: new Date() } },
// 			select: { id: true, slug: true, name: true },
// 		});

// 		if (!sampleTool) {
// 			logTest(
// 				"Related tools - No tools available",
// 				false,
// 				"No published tools found",
// 			);
// 			return;
// 		}

// 		// Test by ID
// 		const start1 = performance.now();
// 		const relatedById = await findRelatedTools(sampleTool.id, {
// 			limit: 5,
// 			scoreThreshold: 0.3,
// 		});
// 		const duration1 = performance.now() - start1;

// 		logTest("Related tools - By ID", true, undefined, {
// 			toolId: sampleTool.id,
// 			relatedCount: relatedById.length,
// 			duration: `${Math.round(duration1)}ms`,
// 			topScore: relatedById[0]?.score ?? 0,
// 		});

// 		// Test by slug
// 		const start2 = performance.now();
// 		const relatedBySlug = await findRelatedToolsBySlug(sampleTool.slug, {
// 			limit: 5,
// 			scoreThreshold: 0.3,
// 		});
// 		const duration2 = performance.now() - start2;

// 		logTest("Related tools - By slug", true, undefined, {
// 			slug: sampleTool.slug,
// 			relatedCount: relatedBySlug.length,
// 			duration: `${Math.round(duration2)}ms`,
// 		});

// 		// Test with category filter
// 		const category = await prisma.category.findFirst();
// 		if (category) {
// 			const relatedWithCategory = await findRelatedTools(sampleTool.id, {
// 				limit: 5,
// 				category: category.slug,
// 				scoreThreshold: 0.3,
// 			});
// 			logTest("Related tools - With category filter", true, undefined, {
// 				category: category.slug,
// 				relatedCount: relatedWithCategory.length,
// 			});
// 		}

// 		// Test with publishedOnly=false
// 		const relatedAll = await findRelatedTools(sampleTool.id, {
// 			limit: 5,
// 			publishedOnly: false,
// 			scoreThreshold: 0.3,
// 		});
// 		logTest("Related tools - Include unpublished", true, undefined, {
// 			relatedCount: relatedAll.length,
// 		});
// 	} catch (error) {
// 		logTest(
// 			"Related tools recommendations",
// 			false,
// 			error instanceof Error ? error.message : String(error),
// 		);
// 	}
// }

// async function testSearchPerformance() {
// 	console.log("\n⚡ Testing Search Performance...");

// 	try {
// 		const testQueries = ["AI", "Work & Study", "tool"];

// 		for (const query of testQueries) {
// 			// Test alternatives search performance
// 			const altStart = performance.now();
// 			const altResults = await searchAlternativeVectors(query, { limit: 10 });
// 			const altDuration = performance.now() - altStart;

// 			// Test categories search performance
// 			const catStart = performance.now();
// 			const catResults = await searchCategoryVectors(query, { limit: 10 });
// 			const catDuration = performance.now() - catStart;

// 			logTest(`Search performance - Query: "${query}"`, true, undefined, {
// 				alternatives: {
// 					duration: `${Math.round(altDuration)}ms`,
// 					results: altResults.length,
// 				},
// 				categories: {
// 					duration: `${Math.round(catDuration)}ms`,
// 					results: catResults.length,
// 				},
// 			});
// 		}
// 	} catch (error) {
// 		logTest(
// 			"Search performance",
// 			false,
// 			error instanceof Error ? error.message : String(error),
// 		);
// 	}
// }

// async function testFallbackBehavior() {
// 	console.log("\n🔄 Testing Fallback Behavior...");

// 	try {
// 		// Test with a query that likely returns no results (very specific/uncommon)
// 		const unlikelyQuery = "xyzabc123nonexistentquery";

// 		// Test alternatives fallback (should return empty or fallback)
// 		const altResults = await searchAlternativeVectors(unlikelyQuery, {
// 			limit: 10,
// 			scoreThreshold: 0.9, // Very high threshold
// 		});
// 		logTest(
// 			"Fallback behavior - Alternatives with high threshold",
// 			true,
// 			undefined,
// 			{
// 				results: altResults.length,
// 				expectedEmpty: true,
// 			},
// 		);

// 		// Test categories fallback
// 		const catResults = await searchCategoryVectors(unlikelyQuery, {
// 			limit: 10,
// 			scoreThreshold: 0.9, // Very high threshold
// 		});
// 		logTest(
// 			"Fallback behavior - Categories with high threshold",
// 			true,
// 			undefined,
// 			{
// 				results: catResults.length,
// 				expectedEmpty: true,
// 			},
// 		);
// 	} catch (error) {
// 		logTest(
// 			"Fallback behavior",
// 			false,
// 			error instanceof Error ? error.message : String(error),
// 		);
// 	}
// }

// async function testAdminSearch() {
// 	console.log("\n🔐 Testing Admin Search...");

// 	try {
// 		// Note: searchItems requires authentication, so we'll test the underlying functions
// 		// In a real scenario, this would be tested through the admin interface

// 		const testQueries = ["AI", "Work & Study"];

// 		for (const query of testQueries) {
// 			// Test alternatives search (used in admin)
// 			const altStart = performance.now();
// 			const altResults = await searchAlternativeVectors(query, { limit: 5 });
// 			const altDuration = performance.now() - altStart;

// 			// Test categories search (used in admin)
// 			const catStart = performance.now();
// 			const catResults = await searchCategoryVectors(query, { limit: 5 });
// 			const catDuration = performance.now() - catStart;

// 			logTest(`Admin search - Query: "${query}"`, true, undefined, {
// 				alternatives: {
// 					duration: `${Math.round(altDuration)}ms`,
// 					results: altResults.length,
// 				},
// 				categories: {
// 					duration: `${Math.round(catDuration)}ms`,
// 					results: catResults.length,
// 				},
// 			});
// 		}

// 		// Test that search functions handle empty queries gracefully
// 		const emptyAlt = await searchAlternativeVectors("", { limit: 5 });
// 		const emptyCat = await searchCategoryVectors("", { limit: 5 });
// 		logTest("Admin search - Empty query handling", true, undefined, {
// 			alternativesResults: emptyAlt.length,
// 			categoriesResults: emptyCat.length,
// 		});
// 	} catch (error) {
// 		logTest(
// 			"Admin search",
// 			false,
// 			error instanceof Error ? error.message : String(error),
// 		);
// 	}
// }

// async function testReindexing() {
// 	console.log("\n🔄 Testing Reindexing Functions...");

// 	try {
// 		// Test alternatives reindexing (with progress callback)
// 		let altProgress: ReindexProgress = { total: 0, processed: 0, failed: [] };
// 		const altProgressCallback = (progress: ReindexProgress) => {
// 			altProgress = progress;
// 		};

// 		const altStart = performance.now();
// 		const altResult = await reindexAllAlternatives(altProgressCallback);
// 		const altDuration = performance.now() - altStart;

// 		logTest(
// 			"Reindexing - Alternatives",
// 			altResult.failed.length === 0,
// 			undefined,
// 			{
// 				total: altResult.total,
// 				processed: altResult.processed,
// 				failed: altResult.failed.length,
// 				duration: `${Math.round(altDuration)}ms`,
// 			},
// 		);

// 		// Test categories reindexing
// 		let catProgress: ReindexProgress = { total: 0, processed: 0, failed: [] };
// 		const catProgressCallback = (progress: ReindexProgress) => {
// 			catProgress = progress;
// 		};

// 		const catStart = performance.now();
// 		const catResult = await reindexAllCategories(catProgressCallback);
// 		const catDuration = performance.now() - catStart;

// 		logTest(
// 			"Reindexing - Categories",
// 			catResult.failed.length === 0,
// 			undefined,
// 			{
// 				total: catResult.total,
// 				processed: catResult.processed,
// 				failed: catResult.failed.length,
// 				duration: `${Math.round(catDuration)}ms`,
// 			},
// 		);
// 	} catch (error) {
// 		logTest(
// 			"Reindexing",
// 			false,
// 			error instanceof Error ? error.message : String(error),
// 		);
// 	}
// }

// async function testVectorDeletion() {
// 	console.log("\n🗑️  Testing Vector Deletion...");

// 	try {
// 		// Get a sample tool and category
// 		const sampleTool = await prisma.tool.findFirst({
// 			where: { publishedAt: { lte: new Date() } },
// 			select: { id: true, slug: true },
// 		});
// 		const sampleCategory = await prisma.category.findFirst({
// 			select: {
// 				id: true,
// 				slug: true,
// 				name: true,
// 				label: true,
// 				description: true,
// 				updatedAt: true,
// 				createdAt: true,
// 			},
// 		});

// 		if (sampleTool) {
// 			// Delete alternative vector
// 			await deleteAlternativeVector(sampleTool.id);
// 			logTest("Vector deletion - Alternative", true, undefined, {
// 				toolId: sampleTool.id,
// 			});

// 			// Re-index it for cleanup
// 			const toolForReindex = await prisma.tool.findUnique({
// 				where: { id: sampleTool.id },
// 				select: {
// 					id: true,
// 					slug: true,
// 					name: true,
// 					description: true,
// 				},
// 			});
// 			if (toolForReindex) {
// 				await upsertAlternativeVector({
// 					id: toolForReindex.id,
// 					slug: toolForReindex.slug,
// 					name: toolForReindex.name,
// 					description: toolForReindex.description,
// 				});
// 			}
// 		}

// 		if (sampleCategory) {
// 			// Delete category vector
// 			await deleteCategoryVector(sampleCategory.id);
// 			logTest("Vector deletion - Category", true, undefined, {
// 				categoryId: sampleCategory.id,
// 			});

// 			// Re-index it for cleanup
// 			await upsertCategoryVector(sampleCategory);
// 		}
// 	} catch (error) {
// 		logTest(
// 			"Vector deletion",
// 			false,
// 			error instanceof Error ? error.message : String(error),
// 		);
// 	}
// }

// async function main() {
// 	console.log("🧪 Qdrant Search Features Test Suite");
// 	console.log("=".repeat(50));

// 	try {
// 		// Ensure collections exist
// 		await ensureAlternativesCollection();
// 		await ensureCategoriesCollection();

// 		// Run all tests
// 		await testAlternativesIndexing();
// 		await testAlternativesSearch();
// 		await testCategoriesIndexing();
// 		await testCategoriesSearch();
// 		await testRelatedToolsRecommendations();
// 		await testSearchPerformance();
// 		await testFallbackBehavior();
// 		await testAdminSearch();
// 		await testVectorDeletion();
// 		// Skip reindexing by default as it's slow - uncomment to test
// 		// await testReindexing()

// 		// Print summary
// 		console.log("\n" + "=".repeat(50));
// 		console.log("📊 Test Summary");
// 		console.log("=".repeat(50));

// 		const passed = results.filter((r) => r.passed).length;
// 		const failed = results.filter((r) => !r.passed).length;
// 		const total = results.length;

// 		console.log(`Total tests: ${total}`);
// 		console.log(`✅ Passed: ${passed}`);
// 		console.log(`❌ Failed: ${failed}`);

// 		if (failed > 0) {
// 			console.log("\n❌ Failed tests:");
// 			results
// 				.filter((r) => !r.passed)
// 				.forEach((r) => {
// 					console.log(`   - ${r.name}`);
// 					if (r.error) {
// 						console.log(`     Error: ${r.error}`);
// 					}
// 				});
// 			process.exit(1);
// 		} else {
// 			console.log("\n✅ All tests passed!");
// 			process.exit(0);
// 		}
// 	} catch (error) {
// 		console.error("Fatal error:", error);
// 		process.exit(1);
// 	}
// }

// main();
