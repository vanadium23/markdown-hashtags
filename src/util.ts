import { InvaildParamError } from "./errors.js";

/**
 * @returns Returns the value if the path exists, else returns undefinded.
 */
export async function getDeepProp<T extends { [key: string]: any }>(obj: T, path: string[]): Promise<any | undefined> {
  let tmp: { [key: string]: any } = obj;
  try {
    for (const p of path.slice(undefined, path.length - 1)) {
      tmp = tmp[p];
    }
    return tmp[path[path.length - 1]];
  } catch (e) {
    return;
  }
}

/**
 * @param autoCreate Auto creates the path if not exists. Default to `true`.
 */
export async function setDeepProp<T extends { [key: string]: any }>(
  obj: T,
  path: string[],
  value: any,
  autoCreate: boolean = true
) {
  let tmp: { [key: string]: any } = obj;
  for (const [i, p] of path.slice(undefined, path.length - 1).entries()) {
    if (autoCreate && tmp[p] === undefined) {
      isNaN(Number(path[i + 1])) ? (tmp[p] = {}) : (tmp[p] = []);
    }
    tmp = tmp[p];
  }
  tmp[path[path.length - 1]] = value;
}

/**
 * @param pushOrConcat Pushes or concatenates to the property. Default to `"push"`
 * @param autoCreate Auto creates the path if not exists. Default to `true`.
 */
export async function addToDeepArr<T extends { [key: string]: any }>(
  obj: T,
  path: string[],
  value: any,
  pushOrConcat: "push" | "concat" = "push",
  autoCreate: boolean = true
) {
  let tmp: { [key: string]: any } = obj;
  for (const [i, p] of path.slice(undefined, path.length - 1).entries()) {
    if (autoCreate && tmp[p] === undefined) {
      isNaN(Number(path[i + 1])) ? (tmp[p] = {}) : (tmp[p] = []);
    }
    tmp = tmp[p];
  }
  if (!(tmp[path[path.length - 1]]?.constructor === Array)) {
    throw new InvaildParamError(`The last property's value isn't a array!\nPath: ${path}`);
  }
  switch (pushOrConcat) {
    case "push":
      tmp[path[path.length - 1]].push(value);
      break;
    case "concat":
      tmp[path[path.length - 1]] = tmp[path[path.length - 1]].concat(value);
      break;
  }
  tmp[path[path.length - 1]] = Array.from(new Set(tmp[path[path.length - 1]]));
}

/**
 * Insert in each elements of the array, like `[1,2,3]` -> `[1,0,2,0,3]`
 */
export async function insertInEachElem<T>(arr: T[], elem: T) {
  let len = arr.length;
  let next = 1;
  while (next < arr.length) {
    arr.splice(next, 0, elem);
    next += 2;
    len++;
  }
}

/**
 * Counts all properties in all depths of the object, using Depth First Search.
 * @param omitObjProps The object property not to be counted, but still search inside of it.
 * @param omitOtherProps The other propery not to be counted, nor search inside of it.
 * @param unique Do not double count properities with the same name. Default to `false`.
 * @returns
 */
export async function deepCountProps(
  obj: { [key: string]: any },
  omitObjProps?: string[],
  omitOtherProps?: string[],
  unique: boolean = false
) {
  const stack: any[] = [];
  let notes: string[] = [];

  const checkObj = (obj: { [key: string]: any }) => {
    for (const k of Object.keys(obj).reverse()) {
      if (omitOtherProps?.includes(k)) {
        return;
      }
      if (!omitObjProps?.includes(k)) {
        notes.push(k);
      }
      if (typeof obj[k] === "object") {
        stack.push(obj[k]);
      }
    }
  };

  if (obj) {
    stack.push(obj);
    while (stack.length) {
      const item = stack.pop()!;
      if (item?.constructor === Object) {
        checkObj(item);
      } else if (item?.constructor === Array) {
        for (const v of item) {
          if (v?.constructor === Object) {
            checkObj(v);
          } else if (v?.constructor === Array) {
            stack.push(v);
          }
        }
      }
    }
  }
  if (unique) {
    notes = Array.from(new Set(notes));
  }

  return notes.length;
}

/**
 * Counts specific array's elements (except object type) in all depths of the object, using Depth First Search.
 * @param arrPropName The property to be count in all depths of the object.
 * @param unique Do not double count properities with the same name. Default to `false`.
 * @returns
 */
export async function deepCountArrElems(obj: { [key: string]: any }, arrPropName: string, unique: boolean = false) {
  const stack: any[] = [];
  let elems: any[] = [];

  const checkObj = (obj: { [key: string]: any }) => {
    for (const k of Object.keys(obj).reverse()) {
      if (typeof obj[k] === "object") {
        stack.push(obj[k]);
      }
      if (obj[k]?.constructor === Array && k === arrPropName) {
        elems = elems.concat(obj[k]);
      }
    }
  };

  if (obj) {
    stack.push(obj);
    while (stack.length) {
      const item = stack.pop()!;
      if (item?.constructor === Object) {
        checkObj(item);
      } else if (item?.constructor === Array) {
        for (const v of item) {
          if (v?.constructor === Object) {
            checkObj(v);
          } else if (v?.constructor === Array) {
            stack.push(v);
          }
        }
      }
    }
  }
  if (unique) {
    elems = Array.from(new Set(elems));
  }

  return elems.length;
}

/**
 * Counts properties of the object with depth 1.
 */
export async function countProps(obj: { [key: string]: any }, omitProps?: string[]) {
  let count = 0;
  Object.keys(obj).forEach((key) => {
    if (omitProps && omitProps.includes(key)) {
      return;
    }
    count++;
  });
  return count;
}

/**
 * Counts specific array's elements (except object type) of the object with depth 1.
 */
export async function countArrElems(obj: { [key: string]: any }, arrPropName: string) {
  let count = 0;
  for (const k of Object.keys(obj)) {
    if (obj[k]?.constructor === Array && k === arrPropName) {
      count += obj[k].length;
    }
  }

  return count;
}

export async function getAllPaths(obj: { [key: string]: any }, omitProps?: string[]) {
  const find = async (obj: { [key: string]: any }, parentPath: string[]): Promise<string[][]> => {
    let paths: string[][] = [];
    const tasks: Promise<string[][]>[] = [];
    for (const k in obj) {
      if (omitProps?.includes(k)) {
        paths.push([...parentPath]);
      } else if (typeof obj[k] === "object") {
        tasks.push(find(obj[k], [...parentPath, k]));
      } else {
        paths.push([...parentPath, k]);
      }
    }
    (await Promise.all(tasks)).forEach((v) => {
      paths = paths.concat(v);
    });

    return paths;
  };

  let allPaths: string[][] = [];
  const tasks: Promise<string[][]>[] = [];
  for (const k in obj) {
    if (typeof obj[k] === "object") {
      tasks.push(find(obj[k], [k]));
    } else if (omitProps?.includes(k)) {
      continue;
    } else {
      allPaths.push([k]);
    }
  }
  (await Promise.all(tasks)).forEach((value) => {
    allPaths = allPaths.concat(value);
  });

  return allPaths;
}
