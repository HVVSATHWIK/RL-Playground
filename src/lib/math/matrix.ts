export class Matrix {
  data: number[][];
  rows: number;
  cols: number;

  constructor(rows: number, cols: number, data?: number[][]) {
    this.rows = rows;
    this.cols = cols;
    this.data = data ?? Array.from({ length: rows }, () => new Array(cols).fill(0));
  }

  static random(rows: number, cols: number, scale = 1): Matrix {
    const data = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => (Math.random() * 2 - 1) * scale)
    );
    return new Matrix(rows, cols, data);
  }

  static zeros(rows: number, cols: number): Matrix {
    return new Matrix(rows, cols);
  }

  static fromArray(arr: number[]): Matrix {
    return new Matrix(arr.length, 1, arr.map(v => [v]));
  }

  static from2D(data: number[][]): Matrix {
    return new Matrix(data.length, data[0].length, data.map(r => [...r]));
  }

  toArray(): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.push(this.data[i][j]);
      }
    }
    return result;
  }

  get(r: number, c: number): number {
    return this.data[r][c];
  }

  set(r: number, c: number, v: number): void {
    this.data[r][c] = v;
  }

  clone(): Matrix {
    return new Matrix(this.rows, this.cols, this.data.map(r => [...r]));
  }

  static multiply(a: Matrix, b: Matrix): Matrix {
    const result = new Matrix(a.rows, b.cols);
    for (let i = 0; i < a.rows; i++) {
      for (let j = 0; j < b.cols; j++) {
        let sum = 0;
        for (let k = 0; k < a.cols; k++) {
          sum += a.data[i][k] * b.data[k][j];
        }
        result.data[i][j] = sum;
      }
    }
    return result;
  }

  static add(a: Matrix, b: Matrix): Matrix {
    const result = new Matrix(a.rows, a.cols);
    for (let i = 0; i < a.rows; i++) {
      for (let j = 0; j < a.cols; j++) {
        result.data[i][j] = a.data[i][j] + b.data[i][j];
      }
    }
    return result;
  }

  static subtract(a: Matrix, b: Matrix): Matrix {
    const result = new Matrix(a.rows, a.cols);
    for (let i = 0; i < a.rows; i++) {
      for (let j = 0; j < a.cols; j++) {
        result.data[i][j] = a.data[i][j] - b.data[i][j];
      }
    }
    return result;
  }

  static elementwise(m: Matrix, fn: (v: number) => number): Matrix {
    const result = new Matrix(m.rows, m.cols);
    for (let i = 0; i < m.rows; i++) {
      for (let j = 0; j < m.cols; j++) {
        result.data[i][j] = fn(m.data[i][j]);
      }
    }
    return result;
  }

  static hadamard(a: Matrix, b: Matrix): Matrix {
    const result = new Matrix(a.rows, a.cols);
    for (let i = 0; i < a.rows; i++) {
      for (let j = 0; j < a.cols; j++) {
        result.data[i][j] = a.data[i][j] * b.data[i][j];
      }
    }
    return result;
  }

  static transpose(m: Matrix): Matrix {
    const result = new Matrix(m.cols, m.rows);
    for (let i = 0; i < m.rows; i++) {
      for (let j = 0; j < m.cols; j++) {
        result.data[j][i] = m.data[i][j];
      }
    }
    return result;
  }

  static scale(m: Matrix, s: number): Matrix {
    return Matrix.elementwise(m, v => v * s);
  }
}
