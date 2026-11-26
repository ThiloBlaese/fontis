import logging
from typing import List, Dict, Any, Optional
import sqlite_utils
import json
import re
import hashlib
import numpy as np

logger = logging.getLogger("fontis_search")

class SearchService:
    _embedding_model = None

    @classmethod
    def get_embedding_model(cls):
        if cls._embedding_model is None:
            import os
            from fastembed import TextEmbedding
            # paraphrase-multilingual-MiniLM-L12-v2 is compact (~118MB) and runs fast on CPU
            cache_dir = os.environ.get("FASTEMBED_CACHE_DIR") or os.path.join(
                os.path.expanduser("~"), ".cache", "fontis", "fastembed"
            )
            os.makedirs(cache_dir, exist_ok=True)
            cls._embedding_model = TextEmbedding(
                model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                cache_dir=cache_dir
            )
        return cls._embedding_model

    def __init__(self, db_path: str = None):
        self.db_path = db_path
        self.db = None
        if db_path:
             import sqlite3
             conn = sqlite3.connect(db_path, check_same_thread=False, timeout=20.0)
             self.db = sqlite_utils.Database(conn)

    def initialize(self):
        pass

    def ensure_embeddings_table(self):
        if not self.db:
            return
        if "records_embeddings" not in self.db.table_names():
            self.db.execute("""
                CREATE TABLE records_embeddings (
                    id TEXT PRIMARY KEY,
                    text_hash TEXT NOT NULL,
                    embedding BLOB NOT NULL
                )
            """)

    def sync_embeddings(self):
        if not self.db:
            return
        self.ensure_embeddings_table()
        
        # Fetch all nodes to build ancestor paths (excluding root nodes)
        nodes_rows = list(self.db.query("SELECT id, label, parent_id FROM nodes"))
        node_map = {n["id"]: {"label": n.get("label", ""), "parent_id": n.get("parent_id")} for n in nodes_rows}
        
        def get_ancestor_labels(node_id: Optional[str]) -> List[str]:
            labels = []
            curr_id = node_id
            while curr_id and curr_id in node_map:
                node = node_map[curr_id]
                parent_id = node.get("parent_id")
                # Exclude root node (where parent_id is None / empty)
                if parent_id is not None and str(parent_id).strip():
                    if node.get("label") and node["label"].strip():
                        labels.append(node["label"].strip())
                curr_id = parent_id
            labels.reverse()
            return labels

        # Query records with node_id (ancestor groups + pure field values)
        records_query = """
            SELECT r.id, r.node_id, r.data
            FROM records r
        """
        records_rows = list(self.db.query(records_query))
        if not records_rows:
            return
            
        # Fetch all existing embeddings (id, text_hash) to detect updates/insertions
        existing = {row["id"]: row["text_hash"] for row in self.db.query("SELECT id, text_hash FROM records_embeddings")}
        
        to_embed_ids = []
        to_embed_texts = []
        to_embed_hashes = []
        
        for row in records_rows:
            rec_id = row["id"]
            ancestor_labels = get_ancestor_labels(row.get("node_id"))
            data_values = []
            if row.get("data"):
                try:
                    data_obj = json.loads(row["data"])
                    if isinstance(data_obj, dict):
                        for val in data_obj.values():
                            if isinstance(val, str) and val.strip():
                                # Handle asset references cleanly: asset:<uuid>|<mime>|<filename>|<thumb>
                                if "asset:" in val:
                                    cleaned_assets = []
                                    for part in val.split(";;"):
                                        part = part.strip()
                                        if part.startswith("asset:"):
                                            pipes = part.split("|")
                                            if len(pipes) >= 3 and pipes[2].strip():
                                                fname = pipes[2].strip()
                                                name_clean = re.sub(r"\.[a-zA-Z0-9]{2,5}$", "", fname)
                                                if name_clean:
                                                    cleaned_assets.append(name_clean)
                                        elif part:
                                            cleaned_assets.append(part)
                                    if cleaned_assets:
                                        data_values.append(" ".join(cleaned_assets))
                                else:
                                    data_values.append(val.strip())
                            elif isinstance(val, (int, float)):
                                data_values.append(str(val))
                except Exception:
                    pass
            
            all_parts = ancestor_labels + data_values
            clean_text = " ".join(all_parts).strip()
            text_hash = hashlib.md5(clean_text.encode("utf-8")).hexdigest()
            
            if rec_id not in existing or existing[rec_id] != text_hash:
                to_embed_ids.append(rec_id)
                to_embed_texts.append(clean_text if clean_text else " ")
                to_embed_hashes.append(text_hash)
                
        if to_embed_ids:
            logger.info(f"Generating embeddings for {len(to_embed_ids)} records...")
            model = self.get_embedding_model()
            embeddings = list(model.embed(to_embed_texts))
            
            with self.db.conn:
                for rec_id, text_hash, emb in zip(to_embed_ids, to_embed_hashes, embeddings):
                    emb_bytes = np.array(emb, dtype=np.float32).tobytes()
                    self.db["records_embeddings"].insert({
                        "id": rec_id,
                        "text_hash": text_hash,
                        "embedding": emb_bytes
                    }, pk="id", replace=True)
            logger.info("Embeddings sync completed.")
            
        # Clean up orphaned embeddings (records that were deleted)
        records_ids_set = {row["id"] for row in records_rows}
        orphaned_ids = [eid for eid in existing if eid not in records_ids_set]
        if orphaned_ids:
            logger.info(f"Cleaning up {len(orphaned_ids)} orphaned embeddings...")
            with self.db.conn:
                placeholders = ",".join(["?"] * len(orphaned_ids))
                self.db.execute(f"DELETE FROM records_embeddings WHERE id IN ({placeholders})", orphaned_ids)

    def semantic_search(self, query_text: str, limit: int = 50, min_score: float = 0.26) -> List[Dict[str, Any]]:
        if not self.db:
            return []
            
        self.sync_embeddings()
        
        rows = list(self.db.query("SELECT id, embedding FROM records_embeddings"))
        if not rows:
            return []
            
        # Load query embedding
        model = self.get_embedding_model()
        query_emb = list(model.embed([query_text]))[0]
        query_vector = np.array(query_emb, dtype=np.float32)
        
        ids = []
        vectors = []
        for row in rows:
            emb_bytes = row["embedding"]
            emb_array = np.frombuffer(emb_bytes, dtype=np.float32)
            if emb_array.shape == (384,):
                ids.append(row["id"])
                vectors.append(emb_array)
                
        if not vectors:
            return []
            
        embeddings_matrix = np.stack(vectors) # shape (N, 384)
        
        # Compute cosine similarity
        dot_product = np.dot(embeddings_matrix, query_vector)
        matrix_norms = np.linalg.norm(embeddings_matrix, axis=1)
        query_norm = np.linalg.norm(query_vector)
        
        # Prevent division by zero
        matrix_norms[matrix_norms == 0] = 1e-10
        if query_norm == 0:
            query_norm = 1e-10
            
        similarities = dot_product / (matrix_norms * query_norm)
        
        # Sort indices by similarity descending and filter by min threshold (33%)
        top_indices = np.argsort(similarities)[::-1]
        
        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            if score < min_score:
                continue
            results.append({
                "id": ids[idx],
                "score": score
            })
            if len(results) >= limit:
                break
            
        return results

    def _get_records_metadata(self, record_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        if not self.db or not record_ids:
            return {}
        placeholders = ",".join(["?"] * len(record_ids))
        sql = f"""
            SELECT 
                r.id, 
                r.node_id, 
                r.record_index,
                r.data,
                n.label as node_label,
                n.layout_config,
                (SELECT COUNT(*) FROM nodes child WHERE child.parent_id = n.id) as child_count
            FROM records r
            JOIN nodes n ON r.node_id = n.id
            WHERE r.id IN ({placeholders})
        """
        rows = list(self.db.query(sql, record_ids))
        return {row["id"]: row for row in rows}

    def _filter_and_format_row(self, row: Dict[str, Any], valid_queries: List[str], min_year: Optional[int], max_year: Optional[int], lowest_level_only: bool = False) -> Optional[Dict[str, Any]]:
        if lowest_level_only and row.get("child_count", 0) > 0:
            return None
        passed_filter = True
        data_json = {}
        try:
            data_json = json.loads(row["data"]) if row["data"] else {}
        except:
            pass

        if min_year is not None or max_year is not None:
            runtime_ranges = [] # list of (start, end) tuples
            laufzeit_field_ids = []
            try:
                layout = json.loads(row["layout_config"]) if row["layout_config"] else []
                for field in layout:
                    if field.get('label', '').strip().upper() == 'LAUFZEIT':
                        laufzeit_field_ids.append(field.get('id'))
            except Exception as e:
                logger.error(f"Error parsing layout config for Laufzeit fields: {e}")

            for field_id in laufzeit_field_ids:
                val = data_json.get(field_id)
                if not isinstance(val, str): continue
                val = val.strip()
                if not val: continue
                
                year_pat = r"^(?:ca\.?|circa|c\.|um)?\s*(\d{4})$"
                date_pat = r"^(?:ca\.?|circa|c\.|um)?\s*(\d{1,2}\.\d{1,2}\.\d{4})$"
                range_pat = r"^(.+?)\s*-\s*(.+?)$"
                
                start_year = None
                end_year = None
                
                m_year = re.match(year_pat, val, re.IGNORECASE)
                m_date = re.match(date_pat, val, re.IGNORECASE)
                
                if m_year:
                    start_year = int(m_year.group(1))
                    end_year = int(m_year.group(1))
                elif m_date:
                     parts = m_date.group(1).split('.')
                     y = int(parts[2])
                     start_year = y
                     end_year = y
                else:
                    m = re.match(range_pat, val)
                    if m:
                        part1 = m.group(1).strip()
                        part2 = m.group(2).strip()
                        
                        y1 = None
                        m_y1 = re.match(year_pat, part1, re.IGNORECASE)
                        m_d1 = re.match(date_pat, part1, re.IGNORECASE)
                        if m_y1: y1 = int(m_y1.group(1))
                        elif m_d1: y1 = int(m_d1.group(1).split('.')[2])
                            
                        y2 = None
                        m_y2 = re.match(year_pat, part2, re.IGNORECASE)
                        m_d2 = re.match(date_pat, part2, re.IGNORECASE)
                        if m_y2: y2 = int(m_y2.group(1))
                        elif m_d2: y2 = int(m_d2.group(1).split('.')[2])
                            
                        if y1 and y2:
                            start_year = y1
                            end_year = y2
                
                if start_year and end_year:
                     runtime_ranges.append((start_year, end_year))

            if not runtime_ranges:
                passed_filter = False
            else:
                r_start, r_end = runtime_ranges[0]
                
                if min_year is not None:
                    if r_end < min_year: passed_filter = False
                    
                if max_year is not None:
                    if r_start > max_year: passed_filter = False
        
        if not passed_filter:
            return None
            
        # Determine "Preview"
        preview_text = ""
        signature = ""
        try:
            layout = json.loads(row["layout_config"]) if row["layout_config"] else []
            data = json.loads(row["data"]) if row["data"] else {}
            
            if layout:
                # 1. Extract signature if field labeled 'signatur' exists
                for field in layout:
                    fl = field.get('label', '').strip().lower()
                    if 'signatur' in fl:
                        fid = field.get('id')
                        if fid and fid in data and data[fid]:
                            val = str(data[fid]).strip()
                            if val:
                                signature = val
                                break

                # 2. Extract preview text (mirrors FormCanvas.jsx magnifying glass detection)
                target_field_id = None

                # Prefer explicit title/subject fields (substring match like frontend FormCanvas)
                for field in layout:
                    fl = field.get('label', '').strip().lower()
                    if any(kw in fl for kw in ('titel', 'betreff', 'bezeichnung', 'name der einrichtung')) or fl == 'name':
                        fid = field.get('id')
                        if fid and str(data.get(fid, '')).strip():
                            target_field_id = fid
                            break

                # Secondary: field whose label matches a search query
                if not target_field_id:
                    for field in layout:
                        field_label = field.get('label', '').strip().lower()
                        for q in valid_queries:
                            if q.lower() in field_label:
                                fid = field.get('id')
                                if fid and str(data.get(fid, '')).strip():
                                    target_field_id = fid
                                    break
                        if target_field_id:
                            break

                # Fallback: top-left field in layout
                if not target_field_id:
                    sorted_fields = sorted(layout, key=lambda f: (f.get('y', 0), f.get('x', 0)))
                    if sorted_fields:
                        target_field_id = sorted_fields[0].get('id')

                if target_field_id and target_field_id in data:
                    val = str(data[target_field_id])
                    preview_text = val[:256] + ("..." if len(val) > 256 else "")
        except Exception as e:
            logger.error(f"Error generating preview: {e}")
            pass

        return {
            "id": row["id"],
            "metadata": {
                "node_id": row["node_id"],
                "node_label": row["node_label"],
                "preview": preview_text,
                "record_index": row["record_index"],
                "signature": signature
            }
        }

    def _filter_and_format_semantic_results(self, semantic_hits: List[Dict[str, Any]], queries: List[str], min_year: Optional[int], max_year: Optional[int], offset: int = 0, limit: int = 50, lowest_level_only: bool = False, min_final_score: float = 0.26) -> List[Dict[str, Any]]:
        if not semantic_hits:
            return []
            
        record_ids = [hit["id"] for hit in semantic_hits]
        metadata_map = self._get_records_metadata(record_ids)
        valid_queries = [q.strip().lower() for q in queries if q and q.strip()]
        
        results = []
        for hit in semantic_hits:
            rec_id = hit["id"]
            if rec_id not in metadata_map:
                continue
                
            row = metadata_map[rec_id]
            formatted = self._filter_and_format_row(row, queries, min_year, max_year, lowest_level_only=lowest_level_only)
            if formatted:
                base_score = float(hit.get("score", 0.0))
                lexical_boost = 0.0
                
                if valid_queries:
                    raw_data = (row.get("data") or "").lower()
                    preview_text = (formatted.get("metadata", {}).get("preview") or "").lower()
                    node_label = (row.get("node_label") or "").lower()
                    
                    for q in valid_queries:
                        # Highest boost if query term appears in Title / Preview: +0.28
                        if q in preview_text:
                            lexical_boost = max(lexical_boost, 0.28)
                        # Substantial boost if query term is in Node label: +0.24
                        elif q in node_label:
                            lexical_boost = max(lexical_boost, 0.24)
                        # Boost if query term appears anywhere in record data: +0.20
                        elif q in raw_data:
                            lexical_boost = max(lexical_boost, 0.20)
                            
                final_score = min(1.0, base_score + lexical_boost)
                if final_score >= min_final_score:
                    formatted["score"] = final_score
                    results.append(formatted)
                
        # Re-sort results by final score descending
        results.sort(key=lambda x: x.get("score", 0.0), reverse=True)
        return results[offset:offset+limit]

    def _search_sql(self, fts_query, limit, lowest_level_only: bool = False):
        sql = """
            SELECT 
                r.id, 
                r.node_id, 
                r.record_index, 
                r.data, 
                n.label as node_label, 
                n.layout_config,
                (SELECT COUNT(*) FROM nodes child WHERE child.parent_id = n.id) as child_count,
                snippet(records_fts, 1, '<b>', '</b>', '...', 10) as match_preview
            FROM records_fts f
            JOIN records r ON f.id = r.id
            JOIN nodes n ON r.node_id = n.id
            WHERE records_fts MATCH ?
        """
        if lowest_level_only:
            sql += " AND n.id NOT IN (SELECT DISTINCT parent_id FROM nodes WHERE parent_id IS NOT NULL AND parent_id != '')"
            
        sql += " ORDER BY rank LIMIT ?"
        return self.db.query(sql, [fts_query, limit])

    def _search_sql_all(self, lowest_level_only: bool = False):
        sql = """
            SELECT 
                r.id, 
                r.node_id, 
                r.record_index, 
                r.data, 
                n.label as node_label, 
                n.layout_config,
                (SELECT COUNT(*) FROM nodes child WHERE child.parent_id = n.id) as child_count,
                '' as match_preview
            FROM records r
            JOIN nodes n ON r.node_id = n.id
        """
        if lowest_level_only:
            sql += " WHERE n.id NOT IN (SELECT DISTINCT parent_id FROM nodes WHERE parent_id IS NOT NULL AND parent_id != '')"
            
        sql += " ORDER BY n.label, r.record_index"
        return self.db.query(sql)

    def search_optimized(self, queries: List[str], limit: int = 50, min_year: Optional[int] = None, max_year: Optional[int] = None, offset: int = 0, lowest_level_only: bool = False, *args, **kwargs) -> List[Dict[str, Any]]:
        if not self.db:
            return []
        valid_queries = [q.strip() for q in queries if q and q.strip()]
        
        # If neither search term nor date bounds are given, nothing to search
        if not valid_queries and min_year is None and max_year is None: 
            return []
        
        results = []
        try:
            if valid_queries:
                DQ = '"'
                escaped_queries = [f'"{q.replace(DQ, "")}"' for q in valid_queries]
                fts_query = f'text_content : ({" AND ".join(escaped_queries)})'
                
                candidate_limit = (offset + limit) * 10 if (min_year or max_year or lowest_level_only) else (offset + limit)
                candidate_limit = max(200, candidate_limit)
                rows = self._search_sql(fts_query, candidate_limit, lowest_level_only=lowest_level_only)
            else:
                # No text query provided -> pure date range search over all records
                rows = self._search_sql_all(lowest_level_only=lowest_level_only)
            
            for row in rows:
                if len(results) >= offset + limit:
                    break
                
                formatted = self._filter_and_format_row(row, valid_queries, min_year, max_year, lowest_level_only=lowest_level_only)
                if formatted:
                    formatted["score"] = 1.0
                    results.append(formatted)
        except Exception as e:
            logger.error(f"Search error: {e}")
            
        return results[offset:offset+limit]

    def hybrid_search(self, queries: List[str], limit: int = 50, min_year: Optional[int] = None, max_year: Optional[int] = None, offset: int = 0, lowest_level_only: bool = False) -> List[Dict[str, Any]]:
        if not queries:
            return []
            
        # 1. Run Lexical (FTS) search
        lexical_limit = (offset + limit) * 2
        lexical_results = self.search_optimized(queries, limit=lexical_limit, min_year=min_year, max_year=max_year, offset=0, lowest_level_only=lowest_level_only)
        
        # 2. Run Semantic search
        full_query = " ".join(queries)
        semantic_hits = self.semantic_search(full_query, limit=lexical_limit)
        semantic_results = self._filter_and_format_semantic_results(semantic_hits, queries, min_year, max_year, offset=0, limit=lexical_limit, lowest_level_only=lowest_level_only)
        
        # 3. Reciprocal Rank Fusion (RRF)
        k = 60
        rrf_scores = {}
        
        for rank, res in enumerate(lexical_results):
            rec_id = res["id"]
            rrf_scores[rec_id] = rrf_scores.get(rec_id, 0.0) + 1.0 / (k + rank + 1)
            
        for rank, res in enumerate(semantic_results):
            rec_id = res["id"]
            rrf_scores[rec_id] = rrf_scores.get(rec_id, 0.0) + 1.0 / (k + rank + 1)
            
        sorted_ids = sorted(rrf_scores.keys(), key=lambda rid: rrf_scores[rid], reverse=True)
        
        results_map = {}
        for res in lexical_results:
            results_map[res["id"]] = res
        for res in semantic_results:
            res_copy = dict(res)
            res_copy["rrf_score"] = rrf_scores[res["id"]]
            results_map[res["id"]] = res_copy
            
        merged_results = []
        for rid in sorted_ids:
            merged_results.append(results_map[rid])
            
        return merged_results[offset:offset+limit]

    def search(self, queries: List[str], limit: int = 50, min_year: Optional[int] = None, max_year: Optional[int] = None, offset: int = 0, mode: str = "classic", lowest_level_only: bool = False, *args, **kwargs) -> List[Dict[str, Any]]:
        if mode in ("semantic", "hybrid"):
            valid_queries = [q.strip() for q in queries if q and q.strip()]
            if not valid_queries:
                if min_year is not None or max_year is not None:
                    return self.search_optimized(queries, limit=limit, min_year=min_year, max_year=max_year, offset=offset, lowest_level_only=lowest_level_only)
                return []
            full_query = " ".join(valid_queries)
            candidate_limit = (offset + limit) * 10 if lowest_level_only else (offset + limit) * 5
            semantic_hits = self.semantic_search(full_query, limit=candidate_limit, min_score=0.18)
            return self._filter_and_format_semantic_results(semantic_hits, queries, min_year=min_year, max_year=max_year, offset=offset, limit=limit, lowest_level_only=lowest_level_only)
        else:
            return self.search_optimized(queries, limit=limit, min_year=min_year, max_year=max_year, offset=offset, lowest_level_only=lowest_level_only)

