                                                      
import { parseMarkers } from './codes.js';
import { applyEdits } from './redactor.js';

                                
                       
                    
                         
                        
 

export function restore(text        , mapping                )                {
  const table = new Map(mapping.map((m) => [m.code, m.original]));
  const edits             = [];
  const missing = new Set        ();
  for (const mk of parseMarkers(text)) {
    const original = table.get(mk.code);
    if (original === undefined) {
      missing.add(mk.code);
      continue;
    }
    edits.push({ start: mk.start, end: mk.end, replacement: original });
  }
  return {
    restoredText: applyEdits(text, edits),
    edits,
    missingCodes: [...missing],
    restoredCount: edits.length,
  };
}
