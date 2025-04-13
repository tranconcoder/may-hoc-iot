String.prototype.addClass = function (newClass?: string) {
    return newClass ? `${this} ${newClass}` : this.toString();
};

export {};
